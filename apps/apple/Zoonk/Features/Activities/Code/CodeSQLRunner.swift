import Foundation

struct SQLResult: Codable, Equatable, Sendable {
  var kind = "rows"
  let columns: [String]
  let rows: [[JSONValue]]
}

enum SQLRun: Equatable, Sendable {
  case done(SQLResult)
  case error(String)
  case timeout
  case tooManyRows
  case unavailable
}

/// Runs a learner's query on the device in main's sandbox (`CodeWorkerSources`), on the sql.js core
/// checks queries with, so a query returns the same rows and errors as on the web, on Android and in
/// the server's check. Each query gets a fresh database, so a DELETE or DROP never carries over, and
/// the result is the last statement that returned a table. Closing the runner, or dropping it,
/// releases the page and everything in it.
@MainActor
final class CodeSQLRunner {
  /// Core's `PROGRAM_TIME_LIMIT_MS.sql`.
  static let timeLimitSeconds = 3
  /// Core's `MAX_QUERY_ROWS` and `MAX_PROGRAM_OUTPUT_LENGTH`: the most an answer can carry.
  private static let maxRows = 200
  private static let maxCellLength = 10_000

  private let page: CodeSandboxPage

  init(timeLimit: TimeInterval = TimeInterval(timeLimitSeconds)) {
    page = CodeSandboxPage(html: CodeWorkerSources.sqlPage(timeLimit: timeLimit))
  }

  /// False when sql.js didn't load, like when offline.
  func warmUp() async -> Bool {
    (try? await page.call("return await warmUp()")) as? Bool ?? false
  }

  func run(query: String, tables: [SQLPlaygroundFields.Table]) async -> SQLRun {
    guard
      let result = try? await page.call(
        "return await run({ query, setup })",
        arguments: ["query": query, "setup": Self.setupStatements(tables)]) as? [String: Any]
    else {
      return .unavailable
    }

    switch result["stop"] as? String {
    case "done": return Self.rows(of: result["table"] as? [String: Any] ?? [:])
    case "error": return .error(result["message"] as? String ?? "")
    case "timeout": return .timeout
    default: return .unavailable
    }
  }

  func close() {
    page.close()
  }

  /// Core's `sqlSetupStatements`: one CREATE TABLE each, then one INSERT per row with the values
  /// bound, never pasted into SQL.
  private static func setupStatements(_ tables: [SQLPlaygroundFields.Table]) -> [[String: Any]] {
    tables.flatMap { table in
      let name = identifier(table.name)
      let columns = table.columns.map { "\(identifier($0.name)) \($0.type.uppercased())" }
      let placeholders = table.columns.map { _ in "?" }.joined(separator: ", ")
      let create: [String: Any] = [
        "params": [Any](), "sql": "CREATE TABLE \(name) (\(columns.joined(separator: ", ")));",
      ]

      return [create]
        + table.rows.map { row in
          ["params": row.map(parameter), "sql": "INSERT INTO \(name) VALUES (\(placeholders));"]
        }
    }
  }

  private static func identifier(_ name: String) -> String {
    "\"\(name.replacingOccurrences(of: "\"", with: "\"\""))\""
  }

  private static func parameter(_ value: JSONValue) -> Any {
    switch value {
    case .number(let number): number
    case .string(let text): text
    default: NSNull()
    }
  }

  /// Core's `runQuery`: a result past the rows an answer can hold is refused, and long text is cut.
  private static func rows(of table: [String: Any]) -> SQLRun {
    let rows = table["rows"] as? [[Any]] ?? []

    guard rows.count <= maxRows else {
      return .tooManyRows
    }

    return .done(
      SQLResult(
        columns: table["columns"] as? [String] ?? [],
        rows: rows.map { $0.map(cell) }))
  }

  private static func cell(_ value: Any) -> JSONValue {
    switch value {
    case let number as NSNumber: .number(number.doubleValue)
    case let text as String: .string(capped(text))
    default: .null
    }
  }

  /// In UTF-16 units, as JavaScript's `slice` counts them in core's `capProgramText`.
  private static func capped(_ text: String) -> String {
    String(decoding: text.utf16.prefix(maxCellLength), as: UTF16.self)
  }
}
