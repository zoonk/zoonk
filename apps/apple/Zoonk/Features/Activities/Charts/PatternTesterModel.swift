import Foundation
import JavaScriptCore

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

  /// Core's grading of a pattern: the regex sorts every example, or the formula gives every
  /// example's output within the tolerance.
  func grade(_ answer: ActivityAnswer) -> Bool {
    guard answer.kind == "pattern", case .string(let pattern) = answer.value["pattern"] else {
      return false
    }

    switch self {
    case .regex(let regex):
      guard let results = PatternRegex.test(pattern, regex: regex) else { return false }
      return (results.shouldMatch + results.shouldNotMatch).allSatisfy(\.passes)
    case .formula(let formula):
      return PatternFormula.test(pattern, formula: formula).allSatisfy(\.passes)
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

/// Regular expressions tested exactly as core grades them: JavaScript's `RegExp` with the `u` flag
/// (run in JavaScriptCore, so the syntax and matching are the same as on the server), and only
/// patterns that can't backtrack for exponential time.
enum PatternRegex {
  private static let maxLength = 200

  private static let script = """
    function zoonkTest(pattern, samples) {
      let regex;
      try { regex = new RegExp(pattern, "u"); } catch (error) { return null; }
      return samples.map((sample) => {
        const found = regex.exec(sample);
        return found ? [found.index, found.index + found[0].length] : [-1, -1];
      });
    }
    """

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

  /// Every sample tested; nil when the pattern is unsafe or doesn't compile.
  static func test(_ pattern: String, regex: PatternTesterFields.Regex)
    -> (shouldMatch: [PatternSampleResult], shouldNotMatch: [PatternSampleResult])?
  {
    guard isSafe(pattern), let context = JSContext() else {
      return nil
    }

    context.evaluateScript(script)
    let samples = regex.shouldMatch + regex.shouldNotMatch

    guard
      let found = context.objectForKeyedSubscript("zoonkTest")?
        .call(withArguments: [pattern, samples]),
      !found.isNull, let ranges = found.toArray() as? [[NSNumber]]
    else {
      return nil
    }

    let results = zip(samples, ranges).enumerated().map { index, item in
      let (sample, range) = item
      let start = range.first?.intValue ?? -1
      let end = range.last?.intValue ?? -1
      let match = start >= 0 ? start..<end : nil
      let shouldMatch = index < regex.shouldMatch.count

      return PatternSampleResult(
        sample: sample, match: match, passes: shouldMatch ? match != nil : match == nil)
    }

    return (
      Array(results.prefix(regex.shouldMatch.count)),
      Array(results.dropFirst(regex.shouldMatch.count))
    )
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
