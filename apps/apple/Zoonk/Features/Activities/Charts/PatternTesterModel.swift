import Foundation

enum PatternTesterFields: Decodable, Hashable, Sendable {
  struct Hint: Decodable, Hashable, Sendable {
    let hint: String
    let mistake: String
  }

  struct Example: Decodable, Hashable, Sendable {
    struct Input: Decodable, Hashable, Sendable {
      let name: String
      let value: Double
    }

    let inputs: [Input]
    let output: Double

    var values: [String: Double] {
      Dictionary(inputs.map { ($0.name, $0.value) }, uniquingKeysWith: { _, last in last })
    }
  }

  struct Regex: Hashable, Sendable {
    let task: String
    let hints: [Hint]
    let shouldMatch: [String]
    let shouldNotMatch: [String]
    let solution: String
  }

  struct Formula: Hashable, Sendable {
    let task: String
    let hints: [Hint]
    let examples: [Example]
    let solution: String
    let tolerance: ActivityCheck.Tolerance
  }

  case regex(Regex)
  case formula(Formula)

  private enum CodingKeys: String, CodingKey {
    case mode, task, hints, shouldMatch, shouldNotMatch, solution, examples, tolerance
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let task = try container.decode(String.self, forKey: .task)
    let hints = try container.decode([Hint].self, forKey: .hints)
    let solution = try container.decode(String.self, forKey: .solution)

    if try container.decode(String.self, forKey: .mode) == "regex" {
      self = .regex(
        Regex(
          task: task, hints: hints,
          shouldMatch: try container.decode([String].self, forKey: .shouldMatch),
          shouldNotMatch: try container.decode([String].self, forKey: .shouldNotMatch),
          solution: solution))
    } else {
      self = .formula(
        Formula(
          task: task, hints: hints,
          examples: try container.decode([Example].self, forKey: .examples),
          solution: solution,
          tolerance: try container.decode(ActivityCheck.Tolerance.self, forKey: .tolerance)))
    }
  }

  var task: String {
    switch self {
    case .regex(let regex): regex.task
    case .formula(let formula): formula.task
    }
  }

  var hints: [Hint] {
    switch self {
    case .regex(let regex): regex.hints
    case .formula(let formula): formula.hints
    }
  }

  var solution: String {
    switch self {
    case .regex(let regex): regex.solution
    case .formula(let formula): formula.solution
    }
  }

}

struct PatternTesterAnswer: Codable, Hashable, Sendable {
  var kind = "pattern"
  let pattern: String
}

struct PatternSampleResult: Hashable, Sendable {
  let sample: String
  let match: Range<Int>?
  let passes: Bool
}

/// Regular expressions tested exactly as core grades them: JavaScript's `RegExp` with the `u` flag,
/// and only patterns that can't backtrack for exponential time.
enum PatternRegex {
  typealias Results = (shouldMatch: [PatternSampleResult], shouldNotMatch: [PatternSampleResult])

  private static let maxLength = 200

  /// Core's `compileSafeRegex` scan: a repeated group that itself repeats or alternates (like
  /// `(a+)+` or `(a|aa)*`) is refused, as are backreferences.
  static func isSafe(_ pattern: String) -> Bool {
    var groups: [Bool] = []
    var escaped = false
    var inClass = false
    var closedRiskyGroup = false

    func markInnermost() {
      if !groups.isEmpty { groups[groups.count - 1] = true }
    }

    for unit in pattern.utf16 {
      let char = Character(Unicode.Scalar(unit) ?? " ")

      if escaped {
        escaped = false
        closedRiskyGroup = false
      } else if char == "\\" {
        escaped = true
        closedRiskyGroup = false
      } else if inClass {
        inClass = char != "]"
        closedRiskyGroup = false
      } else if char == "[" {
        inClass = true
        closedRiskyGroup = false
      } else if char == "(" {
        groups.append(false)
        closedRiskyGroup = false
      } else if char == ")" {
        let risky = groups.popLast() ?? false
        closedRiskyGroup = risky
        if risky { markInnermost() }
      } else if char == "*" || char == "+" || char == "{" {
        if closedRiskyGroup { return false }
        markInnermost()
      } else if char == "|" {
        markInnermost()
        closedRiskyGroup = false
      } else {
        closedRiskyGroup = false
      }
    }

    return pattern.utf16.count <= maxLength && pattern.firstMatch(of: /\\[1-9k]/) == nil
  }
}

/// Tests patterns in a worker on a hidden page, like main, so one that backtracks without end stops
/// at main's `REGEX_TIME_LIMIT_MS` and reads as unable to run: grading stops a regex after 50 ms on
/// the server, so it fails there too. Closing the preview, or dropping it, releases the page.
@MainActor
final class PatternRegexPreview {
  private let page = CodeSandboxPage(html: CodeWorkerSources.regexPage(timeLimit: 1))

  /// Every sample tested; nil when the pattern is unsafe, doesn't compile or runs out of time.
  func test(_ pattern: String, regex: PatternTesterFields.Regex) async -> PatternRegex.Results? {
    guard PatternRegex.isSafe(pattern) else {
      return nil
    }

    let samples = regex.shouldMatch + regex.shouldNotMatch

    guard
      let result = try? await page.call(
        "return await run({ flags: 'u', samples, source })",
        arguments: ["samples": samples, "source": pattern]) as? [String: Any],
      result["stop"] as? String == "done",
      let matches = result["matches"] as? [Any]
    else {
      return nil
    }

    let results = zip(samples, matches).enumerated().map { index, item in
      let (sample, found) = item
      let bounds = found as? [String: Any]
      let match = (bounds?["start"] as? Int).flatMap { start in
        (bounds?["end"] as? Int).map { start..<$0 }
      }
      let shouldMatch = index < regex.shouldMatch.count

      return PatternSampleResult(
        sample: sample, match: match, passes: shouldMatch ? match != nil : match == nil)
    }

    return (
      Array(results.prefix(regex.shouldMatch.count)),
      Array(results.dropFirst(regex.shouldMatch.count))
    )
  }

  func close() {
    page.close()
  }
}

/// Spreadsheet formulas tested as core grades them: a leading "=" is fine, and each example's
/// output must come out within the tolerance.
enum PatternFormula {
  struct Result: Hashable, Sendable {
    let expected: Double
    let value: Double?
    let passes: Bool
  }

  static func test(_ formula: String, formula fields: PatternTesterFields.Formula) -> [Result] {
    let source = String(
      formula.trimmingCharacters(in: .whitespacesAndNewlines).trimmingPrefix("="))

    return fields.examples.map { example in
      let value =
        source.isEmpty ? nil : ActivityExpression.evaluate(source, variables: example.values)

      return Result(
        expected: example.output, value: value,
        passes: value.map {
          ChartsMath.isWithin($0, of: example.output, tolerance: fields.tolerance)
        } ?? false)
    }
  }
}
