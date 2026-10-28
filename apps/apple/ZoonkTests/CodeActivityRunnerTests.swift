import Foundation
import Testing

@testable import Zoonk

@MainActor
struct CodeActivityRunnerTests {
  @Test func javascriptPrintsLikeNodeAndPointsAtTheErrorLine() async {
    let runner = CodeProgramRunner(language: .javascript)

    let success = await runner.run("console.log([1, 2], {a: 1}); console.error('warning');")
    #expect(success.stop == .done)
    #expect(success.output == "[ 1, 2 ] { a: 1 }\n")
    #expect(success.errorOutput == "warning\n")

    let failure = await runner.run("console.log('before');\nthrow new Error('bad');")
    #expect(failure.stop == .error)
    #expect(failure.output == "before\n")
    #expect(failure.error == "Error: bad")
    #expect(failure.errorLine == 2)
  }

  @Test func endlessLoopsStopAndTheNextRunWorks() async {
    let runner = CodeProgramRunner(language: .javascript)

    #expect(await runner.run("while (true) {}").stop == .timeout)

    let flood = await runner.run("while (true) console.log('x'.repeat(1000));")
    #expect(flood.stop == .tooMuchOutput)
    #expect(flood.output.utf16.count <= 10_000)

    let next = await runner.run("console.log(42)")
    #expect(next == CodeProgramRun(stop: .done, output: "42\n"))
  }

  @Test func programsCantReachTheNetwork() async {
    let result = await CodeProgramRunner(language: .javascript).run(
      "console.log(typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof importScripts)")

    #expect(result.output == "undefined undefined undefined undefined\n")
  }

  @Test func aClosedRunnerStartsOverOnTheNextRun() async {
    let runner = CodeProgramRunner(language: .javascript)
    _ = await runner.run("console.log(1)")
    runner.close()

    #expect(await runner.run("console.log(2)").output == "2\n")
  }

  @Test func queriesRunOnAFreshDatabaseEachTime() {
    let tables = [
      SQLPlaygroundFields.Table(
        columns: [.init(name: "name", type: "text"), .init(name: "value", type: "integer")],
        name: "items", rows: [[.string("A's"), .number(2)], [.string("B"), .null]])
    ]

    #expect(
      CodeSQLRunner.run(query: "SELECT name, value FROM items ORDER BY name", tables: tables)
        == .done(SQLResult(columns: ["name", "value"], rows: tables[0].rows)))
    _ = CodeSQLRunner.run(query: "DROP TABLE items", tables: tables)
    #expect(
      CodeSQLRunner.run(query: "SELECT count(*) AS n FROM items", tables: tables)
        == .done(SQLResult(columns: ["n"], rows: [[.number(2)]])))
    #expect(
      CodeSQLRunner.run(query: "SELECT name FROM items WHERE value > 5", tables: tables)
        == .done(SQLResult(columns: ["name"], rows: [])))
  }

  @Test func queriesFailWithSQLitesMessageOrStop() {
    #expect(
      CodeSQLRunner.run(query: "SELECT * FROM missing", tables: [])
        == .error("no such table: missing"))
    #expect(
      CodeSQLRunner.run(query: "ATTACH DATABASE 'other.db' AS other", tables: [])
        == .error("not authorized"))
    #expect(
      CodeSQLRunner.run(
        query:
          "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n",
        tables: [], timeLimit: 0.01) == .timeout)
    #expect(
      CodeSQLRunner.run(
        query:
          "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x < 5000) SELECT x FROM n",
        tables: []) == .tooManyRows)
  }
}
