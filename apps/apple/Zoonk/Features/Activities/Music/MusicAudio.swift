import AVFoundation
import Observation
import QuartzCore
import Synchronization
import os

/// A note to play `at` seconds after the sound starts, ringing `duration` seconds if given.
struct MusicSound: Hashable, Sendable {
  let at: Double
  let midi: Int
  var duration: Double?

  /// Notes struck at once (a chord), strummed when `gap` spreads them a little, or one after
  /// another with a longer gap.
  static func together(_ midis: [Int], gap: Double = 0, at start: Double = 0) -> [MusicSound] {
    midis.enumerated().map { MusicSound(at: start + Double($0.offset) * gap, midi: $0.element) }
  }
}

enum MusicInstrument: Sendable {
  case piano, guitar
}

/// main's clicks: `accent` for a bar's first beat, `beat` for the rest, `hit` for a rhythm's notes.
enum MusicClick: Sendable {
  case accent, beat, hit
}

/// The sound of the music activities, synthesized on the device (main plays sampled instruments
/// and oscillator clicks with Web Audio): a piano, a steel-string guitar and a metronome's
/// clicks. Every sound is scheduled at the moment it is heard, in the host clock touches are
/// timed by (`CACurrentMediaTime`, `UITouch.timestamp`), with the route's output delay taken
/// into account, so a tap and the click it follows share one timeline.
///
/// It plays with the Ring/Silent switch off, as a sound the learner tapped for does in the rest
/// of the app (`.playback`). The engine starts on the first sound, pauses after a moment of
/// silence (no CPU while idle) and is released by `close()` when the activity goes away. An
/// interruption, a lost route or a new one stops what's playing and tells `onInterruption`, since
/// a timed run can't go on with a different delay.
@MainActor
@Observable
final class MusicAudio {
  /// The sound couldn't start: the activity still works, and says so.
  private(set) var isUnavailable = false

  /// Called when the system stopped the sound mid-way (a call, a lost or new route).
  @ObservationIgnored var onInterruption: (() -> Void)?

  @ObservationIgnored private var engine: AVAudioEngine?
  @ObservationIgnored private var renderer: MusicRenderer?
  @ObservationIgnored private var observers: [any NSObjectProtocol] = []
  @ObservationIgnored private var idleTask: Task<Void, Never>?
  @ObservationIgnored private var didActivateSession = false

  /// A note's ring before it's let go, main's default.
  static let noteDuration = 1.2

  /// How far ahead of the soonest moment a sound can be heard notes are placed, so a chord's
  /// spread stays even.
  private static let scheduleAhead = 0.03
  private static let idleSeconds: Duration = .seconds(2)

  /// Plays notes on an instrument, each at its time from `start` (a host time from
  /// `soonestHeardTime()`), or from as soon as they can sound.
  func play(
    _ sounds: [MusicSound], on instrument: MusicInstrument, duration: Double = noteDuration,
    from start: TimeInterval? = nil
  ) {
    guard let soonest = soonestHeardTime(), let renderer else {
      return
    }

    let first = start ?? soonest + Self.scheduleAhead
    renderer.schedule(
      sounds.map { sound in
        MusicRenderer.Event(
          heardAt: first + sound.at, voice: instrument == .piano ? .piano : .guitar,
          midi: sound.midi, duration: sound.duration ?? duration, click: .beat)
      })
    watchForIdle()
  }

  /// Clicks heard at host times (`CACurrentMediaTime`'s clock).
  func click(_ clicks: [(kind: MusicClick, heardAt: TimeInterval)]) {
    guard soonestHeardTime() != nil, let renderer else {
      return
    }

    renderer.schedule(
      clicks.map {
        MusicRenderer.Event(
          heardAt: $0.heardAt, voice: .click, midi: 0, duration: 0, click: $0.kind)
      })
    watchForIdle()
  }

  /// Silences every sound and drops the ones not heard yet.
  func stop() {
    renderer?.stopAll()
  }

  /// The soonest host time a sound scheduled now can be heard, starting the sound if it isn't
  /// running; nil when it can't start.
  func soonestHeardTime() -> TimeInterval? {
    guard start() else {
      isUnavailable = true
      return nil
    }

    if isUnavailable {
      isUnavailable = false
    }
    let session = AVAudioSession.sharedInstance()
    renderer?.setOutputLatency(session.outputLatency)
    return CACurrentMediaTime() + session.ioBufferDuration + session.outputLatency
  }

  /// Stops and releases the engine and gives the audio back to other apps.
  func close() {
    // The screen's handler holds what it stops (often this object): letting go breaks the loop.
    onInterruption = nil
    idleTask?.cancel()
    idleTask = nil

    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }

    observers = []
    releaseEngine()

    if didActivateSession {
      didActivateSession = false
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  /// Starts the sound when it isn't running; a running engine needs nothing more.
  private func start() -> Bool {
    if let engine, engine.isRunning {
      return true
    }

    do {
      let session = AVAudioSession.sharedInstance()

      if session.category != .playback || session.mode != .default {
        try session.setCategory(.playback, mode: .default)
      }

      try? session.setPreferredIOBufferDuration(0.005)
      try session.setActive(true)
      didActivateSession = true

      if engine == nil {
        try buildEngine()
      }

      try engine?.start()
      return true
    } catch {
      releaseEngine()
      return false
    }
  }

  private func buildEngine() throws {
    let engine = AVAudioEngine()
    let sampleRate = engine.outputNode.outputFormat(forBus: 0).sampleRate

    guard sampleRate > 0,
      let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
    else {
      throw MusicAudioError.noOutput
    }

    let renderer = MusicRenderer(sampleRate: sampleRate)
    let source = renderer.sourceNode(format: format)

    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
    engine.prepare()

    self.engine = engine
    self.renderer = renderer
    observe(engine)
  }

  private func releaseEngine() {
    engine?.stop()
    engine = nil
    renderer = nil
  }

  private func observe(_ engine: AVAudioEngine) {
    let center = NotificationCenter.default

    for observer in observers {
      center.removeObserver(observer)
    }

    let session = AVAudioSession.sharedInstance()

    observers = [
      center.addObserver(
        forName: AVAudioSession.interruptionNotification, object: session, queue: .main
      ) { [weak self] notification in
        let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
        let began = type == AVAudioSession.InterruptionType.began.rawValue
        MainActor.assumeIsolated { if began { self?.interrupted() } }
      },
      center.addObserver(
        forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
      ) { [weak self] notification in
        let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
        let changesOutput = [
          AVAudioSession.RouteChangeReason.newDeviceAvailable.rawValue,
          AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue,
        ].contains(reason)
        MainActor.assumeIsolated { if changesOutput { self?.interrupted() } }
      },
      center.addObserver(
        forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
      ) { [weak self] _ in
        // The system stopped the engine for a new format: the next sound builds a new one.
        MainActor.assumeIsolated {
          self?.releaseEngine()
          self?.interrupted()
        }
      },
    ]
  }

  private func interrupted() {
    stop()
    onInterruption?()
  }

  /// Pauses the engine once nothing has sounded or waited to sound for a moment.
  private func watchForIdle() {
    guard idleTask == nil else {
      return
    }

    idleTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(for: Self.idleSeconds)

        guard let self, !Task.isCancelled else {
          return
        }

        if self.renderer?.isSilent ?? true {
          self.engine?.pause()
          self.idleTask = nil
          return
        }
      }
    }
  }
}

private enum MusicAudioError: Error {
  case noOutput
}

/// The synthesizer, run on the audio thread. Events come in through a lock the audio thread only
/// tries, so it never waits on the main thread, and every voice lives in storage allocated up
/// front, so rendering allocates nothing.
final class MusicRenderer: @unchecked Sendable {
  enum VoiceKind: UInt8 {
    case piano, guitar, click
  }

  struct Event: Sendable {
    var heardAt: Double
    var voice: VoiceKind
    var midi: Int
    var duration: Double
    var click: MusicClick
  }

  private struct Inbox: Sendable {
    var events: [Event] = []
    var stops = 0
    var outputLatency: Double = 0
  }

  private struct Voice {
    var isActive = false
    var kind = VoiceKind.piano
    /// Frames of silence before it starts, in the buffer it starts in.
    var wait = 0
    var age = 0
    var length = 0
    var releaseFrames = 1
    var releaseAge = -1
    var gain: Float = 0
    var frequency = 0.0
    var click = MusicClick.beat
    // A guitar string's loop: its delay line, the fractional delay's allpass and the loss.
    var period = 0
    var index = 0
    var allpass = 0.0
    var allpassInput = 0.0
    var allpassOutput = 0.0
    var previous = 0.0
    var loss = 0.0
  }

  private static let voiceCount = 32
  /// A written length past this rings no longer: no sound decays slower.
  private static let longestNote = 30.0
  private static let partials = 6
  private static let delayLength = 2048
  /// Room for every note of the longest melody core accepts (1,000 characters, played twice
  /// through its repeats) before any of it sounds.
  private static let pendingCapacity = 4096
  private static let pianoPartials: [Double] = [1, 0.45, 0.25, 0.14, 0.08, 0.05]

  private let sampleRate: Double
  private let inbox = OSAllocatedUnfairLock(initialState: Inbox())
  private let silent = Atomic<Bool>(true)
  private let voices: UnsafeMutablePointer<Voice>
  /// Per piano voice and partial: amplitude, its loss per frame, and the oscillator's phase as a
  /// rotating vector (re, im) with its turn per frame (cos, sin).
  private let partialState: UnsafeMutablePointer<Double>
  private let delayLines: UnsafeMutablePointer<Float>
  private let pending: UnsafeMutablePointer<Event>
  private var pendingCount = 0
  private var stopsSeen = 0
  private var outputLatency = 0.0
  private var noise: UInt32 = 0x9E37_79B9
  private let secondsPerTick: Double

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
    voices = .allocate(capacity: Self.voiceCount)
    voices.initialize(repeating: Voice(), count: Self.voiceCount)
    partialState = .allocate(capacity: Self.voiceCount * Self.partials * 6)
    partialState.initialize(repeating: 0, count: Self.voiceCount * Self.partials * 6)
    delayLines = .allocate(capacity: Self.voiceCount * Self.delayLength)
    delayLines.initialize(repeating: 0, count: Self.voiceCount * Self.delayLength)
    pending = .allocate(capacity: Self.pendingCapacity)
    pending.initialize(
      repeating: Event(heardAt: 0, voice: .click, midi: 0, duration: 0, click: .beat),
      count: Self.pendingCapacity)

    var timebase = mach_timebase_info_data_t()
    mach_timebase_info(&timebase)
    secondsPerTick = Double(timebase.numer) / Double(timebase.denom) / 1_000_000_000
  }

  deinit {
    voices.deallocate()
    partialState.deallocate()
    delayLines.deallocate()
    pending.deallocate()
  }

  var isSilent: Bool {
    silent.load(ordering: .relaxed) && inbox.withLock { $0.events.isEmpty }
  }

  func schedule(_ events: [Event]) {
    inbox.withLock { $0.events.append(contentsOf: events) }
    silent.store(false, ordering: .relaxed)
  }

  func stopAll() {
    inbox.withLock {
      $0.events.removeAll()
      $0.stops += 1
    }
  }

  func setOutputLatency(_ latency: Double) {
    inbox.withLock { $0.outputLatency = latency }
  }

  // MARK: - Audio thread

  /// The node that pulls sound from this renderer. Made outside the main actor, since the audio
  /// thread calls its block.
  nonisolated func sourceNode(format: AVAudioFormat) -> AVAudioSourceNode {
    AVAudioSourceNode(format: format) { [self] _, timestamp, frameCount, buffers in
      render(timestamp: timestamp, frameCount: Int(frameCount), buffers: buffers)
    }
  }

  func render(
    timestamp: UnsafePointer<AudioTimeStamp>, frameCount: Int,
    buffers: UnsafeMutablePointer<AudioBufferList>
  ) -> OSStatus {
    let list = UnsafeMutableAudioBufferListPointer(buffers)

    guard let output = list.first?.mData?.assumingMemoryBound(to: Float.self) else {
      return noErr
    }

    for frame in 0..<frameCount {
      output[frame] = 0
    }

    takeInbox()

    let hostTime =
      timestamp.pointee.mFlags.contains(.hostTimeValid)
      ? timestamp.pointee.mHostTime : mach_absolute_time()
    let heardAt = Double(hostTime) * secondsPerTick + outputLatency
    startDueEvents(bufferHeardAt: heardAt, frameCount: frameCount)

    var isSounding = false

    for slot in 0..<Self.voiceCount where voices[slot].isActive {
      isSounding = true
      renderVoice(slot, into: output, frameCount: frameCount)
    }

    for frame in 0..<frameCount {
      output[frame] = tanhf(output[frame])
    }

    for buffer in list.dropFirst() {
      buffer.mData?.copyMemory(from: output, byteCount: frameCount * MemoryLayout<Float>.size)
    }

    silent.store(!isSounding && pendingCount == 0, ordering: .relaxed)
    return noErr
  }

  private func takeInbox() {
    inbox.withLockIfAvailable { state in
      if state.stops != stopsSeen {
        stopsSeen = state.stops
        pendingCount = 0

        for slot in 0..<Self.voiceCount where voices[slot].isActive {
          release(slot, frames: Int(sampleRate * 0.01))
        }
      }

      for event in state.events where pendingCount < Self.pendingCapacity {
        pending[pendingCount] = event
        pendingCount += 1
      }

      state.events.removeAll(keepingCapacity: true)
      outputLatency = state.outputLatency
    }
  }

  private func startDueEvents(bufferHeardAt: Double, frameCount: Int) {
    var index = 0

    while index < pendingCount {
      let event = pending[index]
      let offset = Int(((event.heardAt - bufferHeardAt) * sampleRate).rounded())

      if offset < frameCount {
        startVoice(event, wait: max(0, offset))
        pendingCount -= 1
        pending[index] = pending[pendingCount]
      } else {
        index += 1
      }
    }
  }

  private func freeSlot() -> Int {
    var oldest = 0

    for slot in 0..<Self.voiceCount {
      if !voices[slot].isActive {
        return slot
      }

      if voices[slot].age > voices[oldest].age {
        oldest = slot
      }
    }

    return oldest
  }

  private func startVoice(_ event: Event, wait: Int) {
    let slot = freeSlot()
    var voice = Voice()
    voice.isActive = true
    voice.kind = event.voice
    voice.wait = wait
    voice.frequency = 440 * pow(2, Double(event.midi - 69) / 12)

    switch event.voice {
    case .piano:
      voice.gain = 0.22
      voice.length = Int(min(event.duration, Self.longestNote) * sampleRate)
      voice.releaseFrames = Int(0.3 * sampleRate)
      startPiano(slot, frequency: voice.frequency)
    case .guitar:
      voice.gain = 0.5
      voice.length = Int(min(event.duration, Self.longestNote) * sampleRate)
      voice.releaseFrames = Int(0.25 * sampleRate)
      startString(&voice, slot: slot)
    case .click:
      voice.click = event.click
      voice.length = Int(MusicRenderer.clickSeconds * sampleRate)
      voice.releaseFrames = 1
    }

    voices[slot] = voice
  }

  /// A piano note: a few partials, slightly stretched as a real string's are, the higher ones
  /// fading sooner, and lower notes ringing longer.
  private func startPiano(_ slot: Int, frequency: Double) {
    let ring = min(max(2.4 * (261.6 / frequency).squareRoot(), 0.5), 4)
    let state = partialState + slot * Self.partials * 6

    for partial in 0..<Self.partials {
      let number = Double(partial + 1)
      let partialFrequency = frequency * number * (1 + 0.0004 * number * number).squareRoot()
      let isAudible = partialFrequency < sampleRate / 2
      let turn = 2 * Double.pi * partialFrequency / sampleRate
      let decay = (1 + 0.8 * Double(partial)) / ring

      state[partial * 6] = isAudible ? Self.pianoPartials[partial] : 0
      state[partial * 6 + 1] = exp(-decay / sampleRate)
      state[partial * 6 + 2] = 1
      state[partial * 6 + 3] = 0
      state[partial * 6 + 4] = cos(turn)
      state[partial * 6 + 5] = sin(turn)
    }
  }

  /// A plucked steel string (Karplus–Strong): a burst of noise circulating in a loop a period
  /// long, softened a little on every pass.
  private func startString(_ voice: inout Voice, slot: Int) {
    let exact = sampleRate / voice.frequency - 0.5
    var period = Int(exact)
    var fraction = exact - Double(period)

    if fraction < 0.1 {
      period -= 1
      fraction += 1
    }

    period = min(max(period, 2), Self.delayLength - 1)
    voice.period = period
    voice.allpass = (1 - fraction) / (1 + fraction)
    voice.loss = 0.996 - min(voice.frequency / 20_000, 0.01)

    let line = delayLines + slot * Self.delayLength
    var smoothed: Float = 0

    for index in 0..<period {
      noise ^= noise << 13
      noise ^= noise >> 17
      noise ^= noise << 5
      let random = Float(noise) / Float(UInt32.max) * 2 - 1
      smoothed = smoothed * 0.4 + random * 0.6
      line[index] = smoothed
    }
  }

  private static let clickSeconds = 0.05
  private static let clickAttack = 0.002
  private static let clickFloor = 0.0001

  private func renderVoice(_ slot: Int, into output: UnsafeMutablePointer<Float>, frameCount: Int) {
    var voice = voices[slot]
    let state = partialState + slot * Self.partials * 6
    let line = delayLines + slot * Self.delayLength
    var frame = min(voice.wait, frameCount)
    voice.wait -= frame

    while frame < frameCount, voice.isActive {
      var sample: Double

      switch voice.kind {
      case .piano:
        sample = 0

        for partial in 0..<Self.partials {
          let base = partial * 6
          let re = state[base + 2]
          let im = state[base + 3]
          sample += state[base] * im
          state[base] *= state[base + 1]
          state[base + 2] = re * state[base + 4] - im * state[base + 5]
          state[base + 3] = re * state[base + 5] + im * state[base + 4]
        }

        let attack = min(Double(voice.age) / (0.003 * sampleRate), 1)
        sample *= attack

        if state[0] < 0.0005 {
          voice.isActive = false
        }
      case .guitar:
        let next = (voice.index + 1) % voice.period
        let current = Double(line[voice.index])
        let averaged = 0.5 * (current + Double(line[next])) * voice.loss
        let tuned =
          voice.allpass * averaged + voice.allpassInput - voice.allpass * voice.allpassOutput
        voice.allpassInput = averaged
        voice.allpassOutput = tuned
        line[voice.index] = Float(tuned)
        voice.index = next
        sample = current
      case .click:
        sample = clickSample(voice)
      }

      if voice.age >= voice.length, voice.releaseAge < 0 {
        voice.releaseAge = 0
      }

      if voice.releaseAge >= 0 {
        let left = 1 - Double(voice.releaseAge) / Double(voice.releaseFrames)
        sample *= max(left, 0) * max(left, 0)
        voice.releaseAge += 1

        if voice.releaseAge >= voice.releaseFrames {
          voice.isActive = false
        }
      }

      output[frame] += Float(sample) * voice.gain
      voice.age += 1
      frame += 1
    }

    voices[slot] = voice
  }

  /// main's `scheduleClick`: a sine (a triangle for a rhythm's hits) that swells in 2 ms and dies
  /// away by 50 ms, both exponentially.
  private func clickSample(_ voice: Voice) -> Double {
    let (frequency, peak): (Double, Double) =
      switch voice.click {
      case .accent: (1760, 0.5)
      case .beat: (1320, 0.3)
      case .hit: (2400, 0.6)
      }

    let time = Double(voice.age) / sampleRate
    let envelope =
      time < Self.clickAttack
      ? Self.clickFloor * pow(peak / Self.clickFloor, time / Self.clickAttack)
      : peak
        * pow(
          Self.clickFloor / peak, (time - Self.clickAttack) / (Self.clickSeconds - Self.clickAttack)
        )
    let phase = (time * frequency).truncatingRemainder(dividingBy: 1)
    let wave = voice.click == .hit ? 1 - 4 * abs(phase - 0.5) : sin(2 * Double.pi * phase)

    return wave * envelope
  }

  private func release(_ slot: Int, frames: Int) {
    voices[slot].releaseFrames = max(frames, 1)
    voices[slot].releaseAge = 0
    voices[slot].wait = 0
  }
}
