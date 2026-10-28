import Observation
import QuartzCore

/// Where the playhead is: which round and which step of the pattern.
struct RhythmPosition: Hashable {
  let round: Int
  let step: Int
}

/// Runs a rhythm on the audio clock (main's `useRhythmRun`): clicks on every beat, the first one
/// accented, a bar counted in before tapping, and where the playhead is while it plays. Taps are
/// kept in milliseconds from the moment the first step of the first round is heard, as core
/// grades them; listening plays one round with the rhythm's hits.
@MainActor
@Observable
final class RhythmRun {
  enum Kind {
    case listen, tap
  }

  enum Phase: Equatable {
    case idle, countIn, listening, tapping, done
  }

  private struct Timing {
    let kind: Kind
    /// Host time the first step of the first round is heard.
    let roundsStart: TimeInterval
    let end: TimeInterval
    let stepSeconds: Double
  }

  private(set) var taps: [Double] = []
  private(set) var hasFinished = false
  private var timing: Timing?
  @ObservationIgnored private var finishTask: Task<Void, Never>?

  private static let leadIn = 0.15
  private static let tail = 0.5

  var isRunning: Bool { timing != nil }

  /// What the run is doing at host time `now`.
  func phase(at now: TimeInterval) -> Phase {
    guard let timing else {
      return hasFinished ? .done : .idle
    }

    if now < timing.roundsStart {
      return timing.kind == .tap ? .countIn : .listening
    }

    return timing.kind == .tap ? .tapping : .listening
  }

  /// The step being heard at host time `now`, or nil while counting in or after the last round.
  func position(at now: TimeInterval, patternLength: Int) -> RhythmPosition? {
    guard let timing, now >= timing.roundsStart, now <= timing.end else {
      return nil
    }

    let elapsed = Int(((now - timing.roundsStart) / timing.stepSeconds).rounded(.down))
    return RhythmPosition(round: elapsed / patternLength, step: elapsed % patternLength)
  }

  /// Plays the rhythm: listening plays one round with its hits, tapping counts in one bar first
  /// and times every round. `onFinish` gets the taps once the last round has rung out.
  func start(
    _ kind: Kind, fields: RhythmTapperFields, audio: MusicAudio,
    onFinish: @escaping ([Double]) -> Void
  ) {
    reset()

    guard let soonest = audio.soonestHeardTime() else {
      return
    }

    let start = soonest + Self.leadIn
    let stepSeconds = fields.stepMs / 1000
    let beatSeconds = stepSeconds * Double(fields.stepsPerBeat)
    let beats = fields.beats
    let countInBeats = kind == .tap ? beats : 0
    let rounds = kind == .tap ? fields.rounds : 1
    let roundsStart = start + Double(countInBeats) * beatSeconds

    var clicks: [(kind: MusicClick, heardAt: TimeInterval)] = (0..<(countInBeats + rounds * beats))
      .map { beat in
        (beat % beats == 0 ? .accent : .beat, start + Double(beat) * beatSeconds)
      }

    if kind == .listen {
      clicks += fields.hitSteps.map { (.hit, roundsStart + Double($0) * stepSeconds) }
    }

    audio.click(clicks)

    let end = roundsStart + Double(rounds * beats) * beatSeconds
    timing = Timing(kind: kind, roundsStart: roundsStart, end: end, stepSeconds: stepSeconds)

    finishTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(end + Self.tail - CACurrentMediaTime()))

      guard let self, !Task.isCancelled else {
        return
      }

      self.timing = nil
      self.finishTask = nil

      if kind == .tap {
        self.hasFinished = true
        onFinish(self.taps)
      }
    }
  }

  /// Records a tap at its event's host time; taps outside the rounds (or while listening) don't
  /// count.
  func tap(at time: TimeInterval, fields: RhythmTapperFields) {
    guard let timing, timing.kind == .tap else {
      return
    }

    let tapMs = (time - timing.roundsStart) * 1000
    let lastMs = (timing.end - timing.roundsStart) * 1000
    let graceMs = fields.beatMs / 2

    if tapMs >= -graceMs, tapMs <= lastMs + graceMs {
      taps.append(tapMs)
    }
  }

  /// Stops the run and forgets its taps.
  func reset() {
    finishTask?.cancel()
    finishTask = nil
    timing = nil
    taps = []
    hasFinished = false
  }
}

/// The one-time sound check (main's `useDelayCalibration`): a few clicks to count in, then the
/// learner taps along with steady clicks, and the reading is the middle of their taps' distances
/// from the clicks as heard.
@MainActor
@Observable
final class RhythmCalibration {
  enum Phase: Equatable {
    case idle
    case countIn
    case tapping(click: Int)
    case done(delayMs: Double?)
  }

  private struct Timing {
    let measuredStart: TimeInterval
    let end: TimeInterval
    let clicksMs: [Double]
  }

  private(set) var result: Double??
  private var timing: Timing?
  @ObservationIgnored private var taps: [Double] = []
  @ObservationIgnored private var finishTask: Task<Void, Never>?

  private static let leadIn = 0.15

  var isRunning: Bool { timing != nil }

  func phase(at now: TimeInterval) -> Phase {
    guard let timing else {
      return result.map { .done(delayMs: $0) } ?? .idle
    }

    if now < timing.measuredStart {
      return .countIn
    }

    let interval = Rhythm.calibrationIntervalMs / 1000
    return .tapping(click: Int(((now - timing.measuredStart) / interval).rounded(.down)) + 1)
  }

  func start(audio: MusicAudio) {
    cancel()
    result = nil

    guard let soonest = audio.soonestHeardTime() else {
      return
    }

    let start = soonest + Self.leadIn
    let interval = Rhythm.calibrationIntervalMs / 1000
    let total = Rhythm.calibrationCountIn + Rhythm.calibrationClicks

    audio.click(
      (0..<total).map { index in
        (index == Rhythm.calibrationCountIn ? .accent : .beat, start + Double(index) * interval)
      })

    let measuredStart = start + Double(Rhythm.calibrationCountIn) * interval
    let end = start + Double(total) * interval
    let clicksMs = (0..<Rhythm.calibrationClicks).map {
      (measuredStart + Double($0) * interval) * 1000
    }

    taps = []
    timing = Timing(measuredStart: measuredStart, end: end, clicksMs: clicksMs)

    finishTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(end - CACurrentMediaTime()))

      guard let self, !Task.isCancelled else {
        return
      }

      self.result = Rhythm.estimateDeviceDelay(
        clicksMs: clicksMs, intervalMs: Rhythm.calibrationIntervalMs, tapsMs: self.taps)
      self.timing = nil
      self.finishTask = nil
    }
  }

  func tap(at time: TimeInterval) {
    if timing != nil {
      taps.append(time * 1000)
    }
  }

  /// Stops a reading in progress; nothing is measured.
  func cancel() {
    finishTask?.cancel()
    finishTask = nil
    timing = nil
    taps = []
  }
}
