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
    let runner = CodeProgramRunner(language: .javascript, timeLimit: 1)

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

  private func regexFields(shouldMatch: [String], shouldNotMatch: [String]) throws
    -> PatternTesterFields.Regex?
  {
    let fields = try JSONDecoder().decode(
      PatternTesterFields.self,
      from: JSONSerialization.data(
        withJSONObject: [
          "hints": [String](), "mode": "regex", "shouldMatch": shouldMatch,
          "shouldNotMatch": shouldNotMatch, "solution": "", "task": "",
        ] as [String: Any]))

    guard case .regex(let regex) = fields else {
      return nil
    }

    return regex
  }

  @Test func regexesMatchLikeCore() async throws {
    let regex = try #require(
      try regexFields(
        shouldMatch: ["94103", "94103-1234"], shouldNotMatch: ["9410", "941031", "94103-12"]))
    let preview = PatternRegexPreview()

    let solved = try #require(await preview.test("^\\d{5}(-\\d{4})?$", regex: regex))
    #expect((solved.shouldMatch + solved.shouldNotMatch).allSatisfy { $0.passes })
    #expect(await preview.test("(\\d+)+", regex: regex) == nil, "an unsafe pattern doesn't run")
    #expect(await preview.test("(", regex: regex) == nil, "a pattern that doesn't compile")

    let results = try #require(await preview.test("\\d{5}", regex: regex))
    #expect(results.shouldMatch.map(\.match) == [0..<5, 0..<5])
    #expect(results.shouldNotMatch.map(\.passes) == [true, false, false])
  }

  @Test func aPatternThatBacktracksWithoutEndStopsAndTheNextOneIsTestedAtOnce() async throws {
    let regex = try #require(
      try regexFields(shouldMatch: ["aab"], shouldNotMatch: [String(repeating: "a", count: 32)]))
    let preview = PatternRegexPreview()
    _ = await preview.test("a", regex: regex)
    let started = ContinuousClock.now

    #expect(await preview.test(String(repeating: "a*", count: 12) + "b", regex: regex) == nil)
    let stopped = ContinuousClock.now
    #expect(stopped - started < .seconds(3))

    let next = try #require(await preview.test("^a+b$", regex: regex))
    #expect((next.shouldMatch + next.shouldNotMatch).allSatisfy { $0.passes })
    #expect(ContinuousClock.now - stopped < .seconds(2))
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

  @Test func aQueryStopsPastTheRowsAnAnswerCanHoldAndCutsLongCells() {
    let rows = { (count: Int) in
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x < \(count)) SELECT x FROM n"
    }
    let long = CodeSQLRunner.run(
      query: "SELECT replace(hex(zeroblob(20000)), '00', 'x') AS text", tables: [])

    #expect(CodeSQLRunner.run(query: rows(200), tables: []) != .tooManyRows)
    #expect(CodeSQLRunner.run(query: rows(201), tables: []) == .tooManyRows)
    #expect(
      CodeSQLRunner.run(query: "\(rows(201)); SELECT 1 AS one", tables: [])
        == .done(SQLResult(columns: ["one"], rows: [[.number(1)]])),
      "only the last table is the result")
    #expect(
      long
        == .done(
          SQLResult(columns: ["text"], rows: [[.string(String(repeating: "x", count: 10_000))]])))
  }
}
