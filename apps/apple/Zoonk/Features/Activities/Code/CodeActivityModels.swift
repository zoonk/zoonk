import Foundation

struct CodeRunnerFields: Decodable, Sendable {
  struct Mistake: Decodable, Sendable {
    let feedback: String
    let output: String
  }
  let editableLines: [Int]
  let expectedOutput: String
  let fileName: String?
  let language: String
  let mistakes: [Mistake]
  let solution: String
  let starterCode: String
}

struct CodeTracerFields: Decodable, Sendable {
  struct Trace: Decodable, Sendable {
    struct Value: Decodable, Sendable {
      let name: String
      let value: JSONValue
    }
    let line: Int
    let values: [Value]
  }
  struct Pause: Decodable, Sendable {
    struct Option: Decodable, Sendable {
      let id: String
      let text: String
    }
    let options: [Option]
    let question: String
    let step: Int
    let variable: String
  }
  let code: String
  let language: String
  let pauses: [Pause]
  let trace: [Trace]
  let watch: [String]
}

struct CodeSQLResult: Codable, Equatable, Sendable {
  var kind = "rows"
  let columns: [String]
  let rows: [[JSONValue]]

  func matches(_ expected: CodeSQLFields.Expected) -> Bool {
    guard columns.map({ $0.lowercased() }) == expected.columns.map({ $0.lowercased() }) else {
      return false
    }
    if expected.orderMatters { return rows == expected.rows }
    var remaining = expected.rows
    for row in rows {
      guard let index = remaining.firstIndex(of: row) else { return false }
      remaining.remove(at: index)
    }
    return remaining.isEmpty
  }
}

struct CodeSQLFields: Decodable, Sendable {
  struct Mistake: Decodable, Sendable {
    let mistake: String
    let feedback: String
  }
  struct Expected: Decodable, Sendable {
    let columns: [String]
    let rows: [[JSONValue]]
    let orderMatters: Bool
  }
  struct Table: Decodable, Sendable {
    struct Column: Decodable, Sendable {
      let name: String
      let type: String
    }
    let name: String
    let columns: [Column]
    let rows: [[JSONValue]]
  }
  let expected: Expected
  let mistakes: [Mistake]
  let solution: String
  let tables: [Table]
}

enum CodeActivityText {
  static func display(_ value: JSONValue) -> String {
    switch value {
    case .string(let text): text
    case .number(let value):
      number(value)
    case .bool(let value): value ? "true" : "false"
    case .null: "NULL"
    default: ""
    }
  }

  // Trace options use JavaScript's String(number), including its exponent thresholds and -0.
  private static func number(_ value: Double) -> String {
    if value == 0 { return "0" }
    let text = String(value)
    guard let separator = text.firstIndex(of: "e"),
      let exponent = Int(text[text.index(after: separator)...])
    else {
      return text.hasSuffix(".0") ? String(text.dropLast(2)) : text
    }
    let mantissa = String(text[..<separator])
    if abs(value) < 1e-6 || abs(value) >= 1e21 {
      let base = mantissa.hasSuffix(".0") ? String(mantissa.dropLast(2)) : mantissa
      return base + "e" + (exponent >= 0 ? "+" : "-") + String(abs(exponent))
    }
    let sign = value < 0 ? "-" : ""
    let unsigned = mantissa.replacingOccurrences(of: "-", with: "")
    let parts = unsigned.split(separator: ".")
    let digits = parts.joined()
    let point = parts[0].count + exponent
    if point <= 0 { return sign + "0." + String(repeating: "0", count: -point) + digits }
    if point >= digits.count {
      return sign + digits + String(repeating: "0", count: point - digits.count)
    }
    let index = digits.index(digits.startIndex, offsetBy: point)
    return sign + digits[..<index] + "." + digits[index...]
  }

  static func normalize(_ output: String) -> String {
    output.replacingOccurrences(of: "(?m)[\\t ]+$", with: "", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
