import Foundation
import SQLite3

enum CodeSQLRunner {
  struct Failure: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }

  static func run(query: String, tables: [CodeSQLFields.Table], timeLimit: TimeInterval = 3) throws
    -> CodeSQLResult
  {
    var database: OpaquePointer?
    guard sqlite3_open(":memory:", &database) == SQLITE_OK, let database else {
      throw Failure(
        message: String(
          localized: "SQLite unavailable", table: "ActivitiesCode",
          comment: "SQLite could not open an in-memory database"))
    }
    defer { sqlite3_close(database) }
    let deadline = UnsafeMutablePointer<TimeInterval>.allocate(capacity: 1)
    deadline.initialize(to: Date.timeIntervalSinceReferenceDate + timeLimit)
    defer {
      sqlite3_progress_handler(database, 0, nil, nil)
      deadline.deinitialize(count: 1)
      deadline.deallocate()
    }
    sqlite3_progress_handler(
      database, 1000,
      { pointer in
        guard let pointer else { return 1 }
        return Date.timeIntervalSinceReferenceDate
          > pointer.assumingMemoryBound(to: TimeInterval.self).pointee ? 1 : 0
      }, deadline)
    sqlite3_limit(database, SQLITE_LIMIT_LENGTH, 1_000_000)
    sqlite3_limit(database, SQLITE_LIMIT_SQL_LENGTH, 100_000)
    sqlite3_set_authorizer(
      database,
      { _, action, _, _, _, _ in
        action == SQLITE_ATTACH || action == SQLITE_DETACH ? SQLITE_DENY : SQLITE_OK
      }, nil)
    for table in tables {
      let columns = table.columns.map {
        "\(identifier($0.name)) \(["integer", "real"].contains($0.type) ? $0.type : "text")"
      }.joined(separator: ",")
      _ = try execute("CREATE TABLE \(identifier(table.name)) (\(columns))", database: database)
      for row in table.rows {
        let values = row.map { value -> String in
          switch value {
          case .null: "NULL"
          case .number(let n): String(n)
          case .string(let s): "'\(s.replacingOccurrences(of: "'", with: "''"))'"
          default: "NULL"
          }
        }.joined(separator: ",")
        _ = try execute(
          "INSERT INTO \(identifier(table.name)) VALUES (\(values))", database: database)
      }
    }
    return try execute(query, database: database)
  }

  private static func identifier(_ name: String) -> String {
    "\"\(name.replacingOccurrences(of: "\"", with: "\"\""))\""
  }

  private static func execute(_ sql: String, database: OpaquePointer) throws -> CodeSQLResult {
    try sql.withCString { start in
      var cursor: UnsafePointer<CChar>? = start
      var result = CodeSQLResult(columns: [], rows: [])
      while let current = cursor, current.pointee != 0 {
        var statement: OpaquePointer?
        var tail: UnsafePointer<CChar>?
        guard sqlite3_prepare_v2(database, current, -1, &statement, &tail) == SQLITE_OK else {
          throw failure(database)
        }
        cursor = tail
        guard let statement else { break }
        defer { sqlite3_finalize(statement) }
        let count = sqlite3_column_count(statement)
        let columns = (0..<count).map { String(cString: sqlite3_column_name(statement, $0)) }
        var rows: [[JSONValue]] = []
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
          guard rows.count < 1000 else {
            throw Failure(
              message: String(
                localized: "Too many result rows", table: "ActivitiesCode",
                comment: "The query exceeded the result row limit"))
          }
          rows.append(
            (0..<count).map { index in
              switch sqlite3_column_type(statement, index) {
              case SQLITE_NULL: .null
              case SQLITE_INTEGER, SQLITE_FLOAT: .number(sqlite3_column_double(statement, index))
              case SQLITE_BLOB: .string("[blob]")
              default: .string(String(cString: sqlite3_column_text(statement, index)))
              }
            })
          status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else { throw failure(database) }
        if count > 0 { result = CodeSQLResult(columns: columns, rows: rows) }
      }
      return result
    }
  }

  private static func failure(_ database: OpaquePointer) -> Failure {
    Failure(message: String(cString: sqlite3_errmsg(database)))
  }
}
