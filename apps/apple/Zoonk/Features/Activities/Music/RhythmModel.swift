import Foundation

struct RhythmTapperFields: Decodable, Hashable, Sendable {
  /// One bar on a beat grid: "x" is a tap, "." a rest.
  let pattern: String
  let rounds: Int
  let stepsPerBeat: Int
  let tempo: Int
  let toleranceMs: Int

  /// The grid steps marked "x", where a tap should land.
  var hitSteps: [Int] {
    pattern.enumerated().compactMap { $1 == "x" ? $0 : nil }
  }

  /// How long one step of the grid lasts, in milliseconds.
  var stepMs: Double {
    60_000 / Double(tempo) / Double(stepsPerBeat)
  }

  var beatMs: Double {
    stepMs * Double(stepsPerBeat)
  }

  var beats: Int {
    pattern.count / stepsPerBeat
  }

  /// When each tap should land, in milliseconds from the first step of the first round.
  var tapTimesMs: [Double] {
    (0..<rounds).flatMap { round in
      hitSteps.map { Double(round * pattern.count + $0) * stepMs }
    }
  }
}

/// Rhythm timing and grading as core's `music.ts` does it, and how each tap went as main's
/// `rhythm-results.ts` shows it: taps are milliseconds from the first step of the first round,
/// and one steady delay (the device's sound, or the learner's) is taken out before judging.
enum Rhythm {
  /// How far a whole performance may sit from the beat and still count as the device's delay:
  /// Bluetooth headphones add up to about 300 ms, and people anticipate a click a little.
  private static let maxEarlyShiftMs = 80.0
  private static let maxLateShiftMs = 300.0

  /// Once the device's delay was measured, only a small steady drift is still excused.
  private static let maxCalibratedShiftMs = 60.0

  /// The range a measured device delay can take: a little ahead of the click to half a second
  /// late.
  static let deviceDelayRange = -100.0...500.0

  /// A reading from fewer taps than this is a guess, so the learner is asked to tap along again.
  private static let minCalibrationTaps = 4

  /// A tap more than half a beat from every hit isn't aimed at any of them.
  private static let matchWindowShare = 0.5

  /// Clicks counted in before measuring, so the learner has the pulse before tapping along.
  static let calibrationCountIn = 3

  /// Clicks the learner taps along with; the delay is the middle of their taps' distances.
  static let calibrationClicks = 6

  /// 60 bpm: a tap half a second late still sits nearer its own click than the next one.
  static let calibrationIntervalMs = 1000.0

  /// JavaScript's `Math.round`: halves go up, so -2.5 is -2.
  static func jsRound(_ value: Double) -> Double {
    (value + 0.5).rounded(.down)
  }

  static func median(_ values: [Double]) -> Double {
    let sorted = values.sorted()

    guard !sorted.isEmpty else {
      return 0
    }

    let middle = sorted.count / 2
    return sorted.count.isMultiple(of: 2)
      ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
  }

  /// The steady delay of the device's audio in a performance: the median of each tap's distance
  /// from its beat, capped so a rhythm moved onto other beats isn't excused as delay.
  static func delayShift(_ rawOffsetsMs: [Double], calibrated: Bool) -> Double {
    let early = calibrated ? maxCalibratedShiftMs : maxEarlyShiftMs
    let late = calibrated ? maxCalibratedShiftMs : maxLateShiftMs

    return min(max(median(rawOffsetsMs), -early), late)
  }

  /// How late a device plays sound, from tapping along with steady clicks: the median distance
  /// from each click to its nearest tap within half an interval. Nil when too few taps matched a
  /// click, or the reading is too far off to be a delay.
  static func estimateDeviceDelay(clicksMs: [Double], intervalMs: Double, tapsMs: [Double])
    -> Double?
  {
    let offsets = clicksMs.compactMap { click in
      tapsMs.map { $0 - click }.filter { abs($0) <= intervalMs / 2 }.min { abs($0) < abs($1) }
    }

    guard offsets.count >= minCalibrationTaps else {
      return nil
    }

    let delay = jsRound(median(offsets))
    return deviceDelayRange.contains(delay) ? delay : nil
  }

  /// How early (negative) or late each tap was, once the device's steady delay is out: the
  /// measured one when there is one, then the performance's own shift. Taps pair with beats in
  /// time order; nil when the counts differ.
  static func tapOffsets(deviceDelayMs: Double?, expectedMs: [Double], tapsMs: [Double])
    -> [Double]?
  {
    guard tapsMs.count == expectedMs.count, !tapsMs.isEmpty else {
      return nil
    }

    let raw = zip(tapsMs.sorted(), expectedMs).map { $0 - (deviceDelayMs ?? 0) - $1 }
    let shift = delayShift(raw, calibrated: deviceDelayMs != nil)

    return raw.map { $0 - shift }
  }

  /// core's verdict (`rhythm` expected answer): every tap within the tolerance once the steady
  /// delay is out.
  static func grade(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard let fields = try? content.fields(as: RhythmTapperFields.self),
      let taps = answer.tapTimesMs,
      let offsets = tapOffsets(
        deviceDelayMs: answer.deviceDelayMs, expectedMs: fields.tapTimesMs, tapsMs: taps)
    else {
      return false
    }

    return offsets.allSatisfy { abs($0) <= Double(fields.toleranceMs) }
  }

  enum TapStatus: Hashable, Sendable {
    case early, late, missed, onTime
  }

  /// How one hit of the rhythm went: when its tap came, relative to the beat, once delay is out.
  struct HitResult: Hashable, Sendable {
    let offsetMs: Double?
    let status: TapStatus
  }

  /// How each hit went, for showing the learner (grading stays core's): the measured delay comes
  /// out first, taps pair with the nearest hit, the steady delay left comes out as core takes
  /// it out, and leftover taps count as extra.
  static func results(
    beatMs: Double, deviceDelayMs: Double?, expectedMs: [Double], tapsMs: [Double],
    toleranceMs: Double
  ) -> (hits: [HitResult], extraTaps: Int) {
    let heardTaps = tapsMs.map { $0 - (deviceDelayMs ?? 0) }
    let window = beatMs * matchWindowShare
    var used = Set<Int>()

    let pairs: [Double?] = expectedMs.map { time in
      let nearest = heardTaps.indices
        .filter { !used.contains($0) && abs(heardTaps[$0] - time) <= window }
        .min { abs(heardTaps[$0] - time) < abs(heardTaps[$1] - time) }

      guard let nearest else {
        return nil
      }

      used.insert(nearest)
      return heardTaps[nearest]
    }

    let raw = zip(pairs, expectedMs).compactMap { tap, time in tap.map { $0 - time } }
    let shift = raw.isEmpty ? 0 : delayShift(raw, calibrated: deviceDelayMs != nil)

    let hits = zip(pairs, expectedMs).map { tap, time -> HitResult in
      guard let tap else {
        return HitResult(offsetMs: nil, status: .missed)
      }

      let offset = jsRound(tap - time - shift)
      let status: TapStatus =
        abs(offset) <= toleranceMs ? .onTime : offset < 0 ? .early : .late

      return HitResult(offsetMs: offset, status: status)
    }

    return (hits, tapsMs.count - raw.count)
  }

  /// The hit that went furthest off, to name in the feedback, or nil when all were on time.
  static func worstHit(_ hits: [HitResult]) -> (hit: HitResult, index: Int)? {
    let off = hits.enumerated().filter { $0.element.status != .onTime }

    if let missed = off.first(where: { $0.element.status == .missed }) {
      return (missed.element, missed.offset)
    }

    let furthest = off.max { abs($0.element.offsetMs ?? 0) < abs($1.element.offsetMs ?? 0) }
    return furthest.map { ($0.element, $0.offset) }
  }
}

extension ActivityAnswer {
  /// A rhythm: the taps in milliseconds from the first step, with the device's measured delay
  /// when there is one, which core takes out before grading.
  static func rhythm(tapTimesMs: [Double], deviceDelayMs: Double?) -> ActivityAnswer {
    var object: [String: JSONValue] = [
      "kind": .string("rhythm"), "tapTimesMs": .array(tapTimesMs.map(JSONValue.number)),
    ]

    if let deviceDelayMs {
      object["deviceDelayMs"] = .number(deviceDelayMs)
    }

    return ActivityAnswer(value: .object(object))
  }

  var tapTimesMs: [Double]? {
    guard kind == "rhythm", case .array(let items) = value["tapTimesMs"] else {
      return nil
    }

    return items.compactMap { if case .number(let number) = $0 { number } else { nil } }
  }

  var deviceDelayMs: Double? {
    guard case .number(let number) = value["deviceDelayMs"] else {
      return nil
    }

    return number
  }
}
