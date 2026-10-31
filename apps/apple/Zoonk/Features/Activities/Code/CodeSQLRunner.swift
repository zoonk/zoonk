import Foundation
import SQLite3

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
}

/// A fresh in-memory database per run, so a DELETE or DROP never carries over. The result is the
/// last statement that returned a table.
enum CodeSQLRunner {
  static let timeLimitSeconds = 3
  /// Core's `MAX_QUERY_ROWS` and `MAX_PROGRAM_OUTPUT_LENGTH`: the most an answer can carry.
  private static let maxRows = 200
  private static let maxCellLength = 10_000

  static func run(
    query: String, tables: [SQLPlaygroundFields.Table],
    timeLimit: TimeInterval = TimeInterval(timeLimitSeconds)
  ) -> SQLRun {
    var database: OpaquePointer?

    guard sqlite3_open(":memory:", &database) == SQLITE_OK, let database else {
      return .error("SQLite didn't open")
    }

    defer { sqlite3_close(database) }

    var deadline = Date.timeIntervalSinceReferenceDate + timeLimit

    return withUnsafeMutablePointer(to: &deadline) { deadline in
      sqlite3_progress_handler(
        database, 1000,
        { deadline in
          Date.timeIntervalSinceReferenceDate > deadline!.load(as: TimeInterval.self) ? 1 : 0
        }, deadline)
      // One value can't fill the device's memory, and ATTACH can't write files in the app.
      sqlite3_limit(database, SQLITE_LIMIT_LENGTH, 1_000_000)
      sqlite3_set_authorizer(
        database,
        { _, action, _, _, _, _ in
          action == SQLITE_ATTACH || action == SQLITE_DETACH ? SQLITE_DENY : SQLITE_OK
        }, nil)

      do {
        try setUp(tables, in: database)
        return .done(try execute(query, in: database))
      } catch let failure as SQLRun {
        return failure
      } catch {
        return .error(error.localizedDescription)
      }
    }
  }

  /// Core's `sqlSetupStatements`: one CREATE TABLE each, then one INSERT per row with the values
  /// bound, never pasted into SQL.
  private static func setUp(_ tables: [SQLPlaygroundFields.Table], in database: OpaquePointer)
    throws
  {
    for table in tables {
      let columns = table.columns.map { "\(identifier($0.name)) \($0.type.uppercased())" }
      _ = try execute(
        "CREATE TABLE \(identifier(table.name)) (\(columns.joined(separator: ", ")));", in: database
      )

      let placeholders = table.columns.map { _ in "?" }.joined(separator: ", ")
      for row in table.rows {
        _ = try execute(
          "INSERT INTO \(identifier(table.name)) VALUES (\(placeholders));", in: database, bind: row
        )
      }
    }
  }

  private static func identifier(_ name: String) -> String {
    "\"\(name.replacingOccurrences(of: "\"", with: "\"\""))\""
  }

  private static func execute(
    _ sql: String, in database: OpaquePointer, bind values: [JSONValue] = []
  )
    throws -> SQLResult
  {
    try sql.withCString { start in
      var cursor: UnsafePointer<CChar>? = start
      var result = SQLResult(columns: [], rows: [])
      var isResultTooLong = false

      while let current = cursor, current.pointee != 0 {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, current, -1, &statement, &cursor) == SQLITE_OK else {
          throw failure(database)
        }

        // Only whitespace or a comment was left.
        guard let statement else {
          break
        }

        defer { sqlite3_finalize(statement) }

        for (index, value) in values.enumerated() {
          let position = Int32(index + 1)
          switch value {
          case .number(let number): sqlite3_bind_double(statement, position, number)
          case .string(let text): sqlite3_bind_text(statement, position, text, -1, transientText)
          default: sqlite3_bind_null(statement, position)
          }
        }

        let count = sqlite3_column_count(statement)
        let columns = (0..<count).map { String(cString: sqlite3_column_name(statement, $0)) }
        var rows: [[JSONValue]] = []
        var isTooLong = false
        var status = sqlite3_step(statement)

        // Only the last table is the result, as on main: an earlier one past the limit still
        // runs to its end, without keeping its rows.
        while status == SQLITE_ROW {
          if rows.count < maxRows {
            rows.append((0..<count).map { cell(statement, $0) })
          } else {
            isTooLong = true
          }

          status = sqlite3_step(statement)
        }

        guard status == SQLITE_DONE else {
          throw failure(database)
        }

        if count > 0 {
          result = SQLResult(columns: columns, rows: rows)
          isResultTooLong = isTooLong
        }
      }

      guard !isResultTooLong else {
        throw SQLRun.tooManyRows
      }

      return result
    }
  }

  private static func cell(_ statement: OpaquePointer, _ index: Int32) -> JSONValue {
    switch sqlite3_column_type(statement, index) {
    case SQLITE_NULL: .null
    case SQLITE_INTEGER: .number(Double(sqlite3_column_int64(statement, index)))
    case SQLITE_FLOAT: .number(sqlite3_column_double(statement, index))
    case SQLITE_BLOB: .string("[blob]")
    default: .string(capped(String(cString: sqlite3_column_text(statement, index))))
    }
  }

  /// In UTF-16 units, as JavaScript's `slice` counts them in core's `capProgramText`.
  private static func capped(_ text: String) -> String {
    String(decoding: text.utf16.prefix(maxCellLength), as: UTF16.self)
  }

  private static func failure(_ database: OpaquePointer) -> SQLRun {
    sqlite3_errcode(database) == SQLITE_INTERRUPT
      ? .timeout : .error(String(cString: sqlite3_errmsg(database)))
  }
}

extension SQLRun: Error {}

/// SQLite copies bound text before the statement runs.
private let transientText = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
