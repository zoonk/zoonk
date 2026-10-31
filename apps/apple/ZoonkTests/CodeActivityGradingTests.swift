import Foundation
import Testing

@testable import Zoonk

/// The app's instant verdicts agree with core's `checkActivityAnswer`.
struct CodeActivityGradingTests {
  private func content(_ json: String) throws -> ActivityStepContent {
    try JSONDecoder().decode(ActivityStepContent.self, from: Data(json.utf8))
  }

  @Test func outputIgnoresTrailingSpacesAndBlankLines() throws {
    let content = try content(
      #"""
      {"template":"codeRunner","prompt":"Fix it","check":{"kind":"interaction","explanation":"Why"},"fields":{"editableLines":[1],"expectedOutput":"a b\n5050","language":"python","mistakes":[],"solution":"print(1)","starterCode":"print(0)"}}
      """#)

    #expect(ActivityRenderer.codeRunner.grade?(content, .output("a b \t\n5050\n\n")) == true)
    #expect(ActivityRenderer.codeRunner.grade?(content, .output("a  b\n5050")) == false)
  }

  @Test func tracerPredictionsMatchTheTracedValue() throws {
    let content = try content(
      #"""
      {"template":"codeTracer","prompt":"Trace","check":{"kind":"interaction","explanation":"Why"},"fields":{"code":"let x = 1.5;\nx = true;","language":"javascript","pauses":[{"options":[{"id":"a","text":"1.5"},{"id":"b","text":"2"}],"question":"x?","step":0,"variable":"x"},{"options":[{"id":"c","text":"false"},{"id":"d","text":" true "}],"question":"x?","step":1,"variable":"x"}],"trace":[{"line":1,"values":[{"name":"x","value":1.5}]},{"line":2,"values":[{"name":"x","value":true}]}],"watch":["x"]}}
      """#)

    #expect(ActivityRenderer.codeTracer.grade?(content, .assignment(["0": "a", "1": "d"])) == true)
    #expect(
      ActivityRenderer.codeTracer.grade?(content, .assignment(["0": "b", "1": "d"])) == false)
    #expect(CodeTracerFields.text(.number(1451)) == "1451")
    #expect(CodeTracerFields.text(.number(-0.0)) == "0")
  }

  @Test func rowsCompareColumnsWithoutCaseAndRowsAsAMultiset() throws {
    let content = try content(
      #"""
      {"template":"sqlPlayground","prompt":"Query","check":{"kind":"interaction","explanation":"Why"},"fields":{"expected":{"columns":["Name"],"orderMatters":false,"rows":[["A"],["A"],["B"]]},"mistakes":[],"solution":"SELECT name FROM items","tables":[]}}
      """#)
    let grade = ActivityRenderer.sqlPlayground.grade

    #expect(
      grade?(
        content,
        .rows(
          SQLResult(columns: ["NAME"], rows: [[.string("B")], [.string("A")], [.string("A")]]))!)
        == true)
    #expect(
      grade?(content, .rows(SQLResult(columns: ["name"], rows: [[.string("B")], [.string("A")]]))!)
        == false)
  }
}
