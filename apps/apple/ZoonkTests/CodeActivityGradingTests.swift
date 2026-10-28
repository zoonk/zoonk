import Foundation
import Testing

@testable import Zoonk

struct CodeActivityGradingTests {
  @Test func sqlGradingMatchesCore() throws {
    let content = try JSONDecoder().decode(
      ActivityStepContent.self,
      from: Data(
        #"""
        {"template":"sqlPlayground","prompt":"Query","check":{"kind":"interaction","explanation":"Why"},"fields":{"expected":{"columns":["Name"],"orderMatters":false,"rows":[["A"],["A"],["B"]]},"mistakes":[],"solution":"SELECT name FROM items","tables":[]}}
        """#.utf8))
    let renderer = CodeActivityRenderers.all.first { $0.template == "sqlPlayground" }!
    let correct = try ActivityAnswer(
      encoding: CodeSQLResult(
        columns: ["NAME"], rows: [[.string("B")], [.string("A")], [.string("A")]]))
    let duplicateLost = try ActivityAnswer(
      encoding: CodeSQLResult(columns: ["name"], rows: [[.string("B")], [.string("A")]]))
    #expect(renderer.grade?(content, correct) == true)
    #expect(renderer.grade?(content, duplicateLost) == false)
  }

}
