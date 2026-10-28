import Foundation

/// The small numeric rules main's chart activities share (`_utils/snap-value.ts`, core's
/// `template-helpers.ts`, `pattern-checks.ts` and `probability.ts`), so a handle lands where main's
/// would and a readout agrees with grading.
enum ChartsMath {
  /// JavaScript's `Math.round`: halves round up, so -2.5 is -2.
  static func jsRound(_ value: Double) -> Double {
    (value + 0.5).rounded(.down)
  }

  static func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
    min(max(value, low), high)
  }

  /// Rounds float noise away the way `Number(x.toPrecision(12))` does.
  static func clean(_ value: Double) -> Double {
    guard value != 0, value.isFinite else {
      return value
    }

    let digits = 12 - Int((log10(abs(value))).rounded(.down)) - 1
    let factor = pow(10, Double(digits))

    return digits > 300 || digits < -300 ? value : (value * factor).rounded() / factor
  }

  /// Whether a value is a whole number of steps, allowing for float noise.
  static func isMultiple(_ value: Double, of step: Double) -> Bool {
    let ratio = value / step
    return abs(ratio - ChartsMath.jsRound(ratio)) < 1e-9 * max(1, abs(ratio))
  }

  /// The nearest position the learner can reach (min plus whole steps), without float noise.
  static func snap(_ value: Double, min low: Double, max high: Double, step: Double) -> Double {
    let steps = ChartsMath.jsRound((clamp(value, low, high) - low) / step)
    return clamp(clean(low + steps * step), low, high)
  }

  static func isClose(_ value: Double, _ expected: Double, slack: Double = 1e-9) -> Bool {
    abs(value - expected) <= slack * max(1, abs(expected))
  }

  /// Core's `withinTolerance`: the allowance plus a little relative slack for rounded boundaries.
  static func isWithin(_ value: Double, of expected: Double, tolerance: ActivityCheck.Tolerance)
    -> Bool
  {
    let allowed =
      tolerance.kind == .absolute ? tolerance.value : tolerance.value * abs(expected)
    let slack = 1e-9 * max(abs(expected), abs(value), allowed)

    return abs(value - expected) <= allowed + slack || isClose(value, expected)
  }

  /// A round step (1, 2, 2.5 or 5 times a power of ten) that splits a span into about `count`.
  static func niceStep(_ span: Double, count: Int = 4) -> Double {
    guard span > 0, count > 0 else {
      return 1
    }

    let rough = span / Double(count)
    let magnitude = pow(10, log10(rough).rounded(.down))
    let nice = [1, 2, 2.5, 5, 10].first { $0 * magnitude >= rough } ?? 10

    return nice * magnitude
  }

  /// A domain that holds every value with round ends, from zero when every value sits on one side
  /// of it (main's `niceDomain`).
  static func niceDomain(_ values: [Double], includesZero: Bool = true) -> ClosedRange<Double> {
    let finite = values.filter(\.isFinite) + (includesZero ? [0] : [])

    guard var low = finite.min(), var high = finite.max() else {
      return 0...1
    }

    if low == high {
      let pad = max(abs(low) * 0.1, 1)
      (low, high) = (low - pad, high + pad)
    }

    let step = niceStep(high - low)
    return clean((low / step).rounded(.down) * step)...clean((high / step).rounded(.up) * step)
  }

  // MARK: - Probability

  /// Abramowitz and Stegun 7.1.26, as core computes it, so a readout matches grading to the digit.
  static func erf(_ value: Double) -> Double {
    let coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]
    let sign: Double = value > 0 ? 1 : value < 0 ? -1 : 0
    let x = abs(value)
    let t = 1 / (1 + 0.3275911 * x)
    let polynomial = coefficients.reversed().reduce(0) { $0 * t + $1 } * t

    return sign * (1 - polynomial * exp(-x * x))
  }

  static func normalCdf(mean: Double, sd: Double, value: Double) -> Double {
    (1 + erf((value - mean) / (sd * 2.0.squareRoot()))) / 2
  }

  private static func logChoose(_ total: Int, _ chosen: Int) -> Double {
    (0..<chosen).reduce(0) { sum, index in
      sum + log(Double(total - chosen + index + 1)) - log(Double(index + 1))
    }
  }

  static func binomialHitProbability(trials: Int, probability: Double, hit: (Int) -> Bool)
    -> Double
  {
    (0...trials).filter(hit).reduce(0) { sum, count in
      sum
        + exp(
          logChoose(trials, count) + Double(count) * log(probability)
            + Double(trials - count) * log(1 - probability))
    }
  }

  static func diceSumHitProbability(count: Int, sides: Int, hit: (Int) -> Bool) -> Double {
    var ways = [1.0]

    for _ in 0..<count {
      ways = (0..<(ways.count + sides)).map { total in
        (0..<sides).reduce(0) { sum, face in
          let index = total - face - 1
          return sum + (index >= 0 && index < ways.count ? ways[index] : 0)
        }
      }
    }

    let outcomes = pow(Double(sides), Double(count))

    return ways.enumerated().reduce(0) { sum, item in
      hit(item.offset) ? sum + item.element / outcomes : sum
    }
  }

  static func sharedBirthdayProbability(people: Int, days: Int) -> Double {
    guard people <= days else {
      return 1
    }

    return 1 - (0..<people).reduce(1) { $0 * (Double(days - $1) / Double(days)) }
  }
}

/// Main's seeded generator (`@zoonk/utils/seeded-random`): a simulation's first run is the same
/// for everyone, and "Run again" picks a new seed.
struct ChartsRandom {
  private static let modulus = 2_147_483_647
  private var state: Int

  init(seed: Int) {
    state = (abs(seed) % (Self.modulus - 1)) + 1
  }

  mutating func next() -> Double {
    state = (state * 48_271) % Self.modulus
    return Double(state - 1) / Double(Self.modulus - 1)
  }

  /// A standard normal draw (Box-Muller) from two uniform draws.
  mutating func standardNormal() -> Double {
    let radius = (-(2 * log(1 - next()))).squareRoot()
    return radius * cos(2 * .pi * next())
  }

  mutating func binomialCount(trials: Int, probability: Double) -> Int {
    (0..<trials).reduce(0) { sum, _ in sum + (next() < probability ? 1 : 0) }
  }

  /// `JSON.stringify` of a template's fields as main's player sees them: after core's schema parse,
  /// which writes keys in the schemas' (alphabetical) order whatever order Postgres stored them in,
  /// so the seed matches main's.
  static func json(_ value: JSONValue) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return (try? encoder.encode(value)).flatMap { String(data: $0, encoding: .utf8) } ?? ""
  }
}
