import Foundation
import Testing

@testable import Zoonk

struct CodeActivityRunnerTests {
  @Test @MainActor func javascriptOutputAndErrors() async {
    let runner = CodeProgramRunner()
    let success = await runner.run(
      code: "console.log([1, 2], {a: 1}); console.error('warning');", language: "javascript")
    #expect(success.stop == .done)
    #expect(success.output == "[ 1, 2 ] { a: 1 }\n")
    #expect(success.errorOutput == "warning\n")
    let failure = await runner.run(
      code: "console.log('before'); throw new Error('bad');", language: "javascript")
    #expect(failure.stop == .error)
    #expect(failure.output == "before\n")
    #expect(failure.message?.contains("bad") == true)
  }

  @Test @MainActor func javascriptTimeoutReleasesRunner() async {
    let runner = CodeProgramRunner()
    let timeout = await runner.run(code: "while(true) {}", language: "javascript")
    #expect(timeout.stop == .timeout)
    let next = await runner.run(code: "console.log(42)", language: "javascript")
    #expect(next.stop == .done)
    #expect(next.output == "42\n")
  }

  @Test @MainActor func javascriptCannotReachHostAPIs() async {
    let result = await CodeProgramRunner().run(
      code:
        "console.log(typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof postMessage, typeof post)",
      language: "javascript")
    #expect(result.output == "undefined undefined undefined undefined undefined\n")
  }

  @Test func pythonBridgeParsing() {
    #expect(
      CodeProgramRunner.parseMessage(["type": "output", "stream": "stdout", "text": "42\n"])
        == .output("stdout", "42\n"))
    #expect(
      CodeProgramRunner.parseMessage(["type": "error", "message": "ValueError: bad"])
        == .end(.error, "ValueError: bad"))
    #expect(
      CodeProgramRunner.parseMessage(["type": "output", "stream": "other", "text": "x"]) == nil)
    #expect(CodeProgramRunner.parseMessage(["type": "output"]) == nil)
  }

  @Test func sqlResultsAndFreshDatabase() throws {
    let tables = [
      CodeSQLFields.Table(
        name: "items",
        columns: [.init(name: "name", type: "text"), .init(name: "value", type: "integer")],
        rows: [[.string("A's"), .number(2)], [.string("B"), .null]])
    ]
    let result = try CodeSQLRunner.run(
      query: "SELECT name, value FROM items ORDER BY name", tables: tables)
    #expect(result.columns == ["name", "value"])
    #expect(result.rows == tables[0].rows)
    _ = try CodeSQLRunner.run(query: "DROP TABLE items", tables: tables)
    #expect(
      try CodeSQLRunner.run(query: "SELECT count(*) AS n FROM items", tables: tables).rows == [
        [.number(2)]
      ])
  }

  @Test func sqlErrorsAndTimeout() {
    #expect(throws: CodeSQLRunner.Failure.self) {
      try CodeSQLRunner.run(
        query:
          "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20) SELECT printf('%010000d', x) AS value FROM n",
        tables: [])
    }

    #expect(throws: CodeSQLRunner.Failure.self) {
      try CodeSQLRunner.run(query: "SELECT * FROM missing", tables: [])
    }
    #expect(throws: CodeSQLRunner.Failure.self) {
      try CodeSQLRunner.run(query: "ATTACH DATABASE '/tmp/escape.db' AS escape", tables: [])
    }
    #expect(throws: CodeSQLRunner.Failure.self) {
      try CodeSQLRunner.run(
        query:
          "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n",
        tables: [], timeLimit: 0.01)
    }
  }

  @Test func outputNormalizationPreservesInteriorWhitespace() {
    #expect(CodeActivityText.normalize(" 42 \t\n\n") == "42")
    #expect(CodeActivityText.normalize("a  b") != CodeActivityText.normalize("a b"))
    #expect(CodeActivityText.normalize("a \t\r\nb \t\r\n") == "a\r\nb")
    #expect(CodeActivityText.display(.number(0.123456)) == "0.123456")
    #expect(CodeActivityText.display(.number(-0.0)) == "0")
    #expect(CodeActivityText.display(.number(1e-7)) == "1e-7")
    #expect(CodeActivityText.display(.number(1e-6)) == "0.000001")
    #expect(CodeActivityText.display(.number(1e20)) == "100000000000000000000")
  }

  @Test @MainActor func cancellationAndOutputFloodStopTheWorker() async throws {
    let runner = CodeProgramRunner()
    let pending = Task { await runner.run(code: "while(true) {}", language: "javascript") }
    try await Task.sleep(for: .milliseconds(100))
    pending.cancel()
    #expect(await pending.value.stop == .cancelled)
    let flood = await runner.run(
      code: "while(true) console.log('x'.repeat(1000));", language: "javascript")
    #expect(flood.stop == .tooMuchOutput)
    #expect(flood.output.utf16.count <= 10_000)
    let unicode = await runner.run(
      code: "console.log('a' + String.fromCharCode(769).repeat(10000))", language: "javascript")
    #expect(unicode.stop == .tooMuchOutput)
    #expect(unicode.output.utf16.count == 10_000)
    let next = await runner.run(code: "console.log('ready')", language: "javascript")
    #expect(next.output == "ready\n")
  }
}
