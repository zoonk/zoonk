import AVFoundation
import Observation

enum MicrophoneProblem: Equatable {
  case denied
  case unavailable
}

struct VoiceRecording: Sendable {
  let attemptId = UUID().uuidString
  let audio: Data
  let durationMs: Int
  /// How long the microphone took to start after the learner pressed Record (and answered the
  /// permission prompt, if one showed): the grader reads a long wait as a first word likely lost.
  var micStartupMs: Int? = nil
}

/// Each recording lives in a temporary file that's read and deleted as soon as it stops, so nothing
/// is kept. An interruption (a phone call, Siri) throws the recording away: half a sentence isn't
/// worth grading.
@MainActor
@Observable
final class VoiceRecorder {
  enum Status: Equatable {
    case idle
    /// From the press until the recorder's own clock moves: the learner waits for "Speak now".
    case acquiring
    case recording(startedAt: Date)
    case failedToStart(MicrophoneProblem)

    var startProblem: MicrophoneProblem? {
      if case .failedToStart(let problem) = self { return problem }
      return nil
    }
  }

  /// A spoken answer is one sentence; a longer recording is a microphone left on.
  static let maxDuration: TimeInterval = 30
  private static let meterInterval = Duration.milliseconds(100)
  /// More than the widest cue row draws.
  private static let levelHistory = 160
  /// The contract's bound: a longer startup isn't a measurement.
  private static let maxStartup = Duration.seconds(60)

  private(set) var status = Status.idle
  /// From 0 to 1, oldest first, one every `meterInterval` since the take went live.
  private(set) var recentLevels: [Double] = []
  @ObservationIgnored private var micStartupMs: Int?
  @ObservationIgnored private var recorder: AVAudioRecorder?
  @ObservationIgnored private var delegate: RecorderDelegate?
  @ObservationIgnored private var meter: Task<Void, Never>?
  @ObservationIgnored private var interruption: (any NSObjectProtocol)?
  @ObservationIgnored private var onRecorded: (@MainActor (VoiceRecording) -> Void)?
  @ObservationIgnored private var acquisition = 0

  var isRecording: Bool {
    if case .recording = status {
      return true
    }

    return false
  }

  var microphoneProblem: MicrophoneProblem? {
    status.startProblem ?? (AVAudioApplication.shared.recordPermission == .denied ? .denied : nil)
  }

  func start(onRecorded: @escaping @MainActor (VoiceRecording) -> Void) async {
    guard status == .idle || status.startProblem != nil else {
      return
    }

    var pressedAt = ContinuousClock.now
    let wasAsked = AVAudioApplication.shared.recordPermission == .undetermined
    status = .acquiring
    acquisition += 1
    let mine = acquisition
    let isAllowed = await AVAudioApplication.requestRecordPermission()

    guard acquisition == mine else {
      return
    }

    guard isAllowed else {
      status = .failedToStart(.denied)
      return
    }

    // Time spent answering the permission prompt isn't the microphone's.
    if wasAsked {
      pressedAt = .now
    }

    guard await openSession(), acquisition == mine, let recorder = makeRecorder() else {
      if acquisition == mine {
        SharedAudioSession.release(for: self)
        status = .failedToStart(.unavailable)
      } else if status == .idle {
        // Cancelled while the session opened, and no other take has it since.
        SharedAudioSession.release(for: self)
      }

      return
    }

    let delegate = RecorderDelegate { [weak self, weak recorder] in
      guard let recorder, self?.recorder === recorder else { return }
      self?.finish()
    }
    recorder.delegate = delegate
    recorder.isMeteringEnabled = true

    guard recorder.record(forDuration: Self.maxDuration) else {
      discard(recorder)
      SharedAudioSession.release(for: self)
      status = .failedToStart(.unavailable)
      return
    }

    self.recorder = recorder
    self.delegate = delegate
    self.onRecorded = onRecorded
    observeInterruptions()
    watch(recorder, pressedAt: pressedAt)
  }

  func stop() {
    recorder?.stop()
  }

  func cancel() {
    acquisition += 1
    onRecorded = nil

    if status == .acquiring {
      status = .idle
    }

    recorder?.stop()
  }

  /// Off the main actor: switching to a headset's microphone can take a second, and "Getting
  /// ready…" has to draw meanwhile.
  private func openSession() async -> Bool {
    do {
      try await SharedAudioSession.activate(for: self) { session in
        try session.setCategory(
          .playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        // Without it, the tap that says the take is live never plays.
        try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
      }
      return true
    } catch {
      return false
    }
  }

  private func makeRecorder() -> AVAudioRecorder? {
    let url = FileManager.default.temporaryDirectory
      .appending(path: "voice-\(UUID().uuidString).m4a")

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 22_050,
      AVNumberOfChannelsKey: 1,
      AVEncoderBitRateKey: 32_000,
    ]

    return try? AVAudioRecorder(url: url, settings: settings)
  }

  private func finish() {
    guard let recorder else {
      return
    }

    let durationMs: Int

    if case .recording(let startedAt) = status {
      durationMs = Int(min(Date.now.timeIntervalSince(startedAt), Self.maxDuration) * 1000)
    } else {
      durationMs = 0
    }

    let audio = try? Data(contentsOf: recorder.url)
    let deliver = onRecorded
    let failedToStart = status == .acquiring && deliver != nil
    let startup = micStartupMs
    discard(recorder)
    self.recorder = nil
    delegate = nil
    onRecorded = nil
    meter?.cancel()
    meter = nil
    recentLevels = []
    micStartupMs = nil
    status = failedToStart ? .failedToStart(.unavailable) : .idle
    stopObservingInterruptions()
    SharedAudioSession.release(for: self)

    if !failedToStart, let audio, !audio.isEmpty, let deliver {
      deliver(VoiceRecording(audio: audio, durationMs: durationMs, micStartupMs: startup))
    }
  }

  private func discard(_ recorder: AVAudioRecorder) {
    recorder.deleteRecording()
  }

  /// The take goes live when the recorder's own clock moves, not when `record` returns: until then
  /// the microphone may still be switching on, and a word said then is lost.
  private func watch(_ recorder: AVAudioRecorder, pressedAt: ContinuousClock.Instant) {
    meter = Task { [weak self] in
      while !Task.isCancelled {
        guard let self, self.recorder === recorder else {
          return
        }

        if isRecording {
          recorder.updateMeters()
          // -50 dB is silence for speech; 0 dB is the loudest.
          let power = Double(recorder.averagePower(forChannel: 0))
          recentLevels.append(min(1, max(0, (power + 50) / 50)))
          recentLevels.removeFirst(max(0, recentLevels.count - Self.levelHistory))
          try? await Task.sleep(for: Self.meterInterval)
        } else if recorder.currentTime > 0 {
          let startup = ContinuousClock.now - pressedAt
          micStartupMs = startup <= Self.maxStartup ? Int(startup / .milliseconds(1)) : nil
          status = .recording(startedAt: .now)
        } else {
          try? await Task.sleep(for: .milliseconds(10))
        }
      }
    }
  }

  private func observeInterruptions() {
    interruption = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt

      guard type == AVAudioSession.InterruptionType.began.rawValue else {
        return
      }

      MainActor.assumeIsolated {
        self?.cancel()
      }
    }
  }

  private func stopObservingInterruptions() {
    if let interruption {
      NotificationCenter.default.removeObserver(interruption)
    }

    interruption = nil
  }
}

/// `AVAudioRecorder` reports its end to an `NSObject` delegate.
private final class RecorderDelegate: NSObject, AVAudioRecorderDelegate, @unchecked Sendable {
  private let onFinish: @MainActor () -> Void

  init(onFinish: @escaping @MainActor () -> Void) {
    self.onFinish = onFinish
  }

  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    Task { @MainActor in onFinish() }
  }

  func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: (any Error)?) {
    Task { @MainActor in onFinish() }
  }
}
