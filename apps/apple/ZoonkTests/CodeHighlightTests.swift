import XCTest

@testable import Zoonk

/// Main's `highlight-code.test.ts`, so each app colors the same tokens.
final class CodeHighlightTests: XCTestCase {
  private typealias Colored = [[String]]

  private func colored(_ line: [CodeHighlight.Token]?) -> Colored {
    (line ?? []).filter { $0.kind != .plain }.map { ["\($0.kind)", $0.text] }
  }

  private func coloredLine(_ code: String, _ language: String?) -> Colored {
    colored(CodeHighlight.lines(of: code, language: language).first)
  }

  func testColorsPythonKeywordsBuiltinsNumbersAndComments() {
    XCTAssertEqual(
      coloredLine("for n in range(1, 100):  # count", "python"),
      [
        ["keyword", "for"], ["keyword", "in"], ["builtin", "range"], ["number", "1"],
        ["number", "100"], ["comment", "# count"],
      ])
  }

  func testKeepsTheTextOfEveryLineExactlyIncludingIndentation() {
    let code = "total = 0\nfor n in range(3):\n    total += n\n\tprint(total)  "

    XCTAssertEqual(
      CodeHighlight.lines(of: code, language: "python").map { $0.map(\.text).joined() },
      code.components(separatedBy: "\n"))
  }

  func testKeepsEmptyLines() {
    XCTAssertEqual(CodeHighlight.lines(of: "a = 1\n\nb = 2", language: "python").count, 3)
  }

  func testColorsAStringSpanningLinesOnEachLine() {
    let lines = CodeHighlight.lines(of: "s = \"\"\"one\ntwo\"\"\"", language: "python")

    XCTAssertEqual(colored(lines[0]), [["string", "\"\"\"one"]])
    XCTAssertEqual(colored(lines[1]), [["string", "two\"\"\""]])
  }

  func testColorsJavaScriptStringsAndTemplateLiteralsAndLeavesIdentifiersPlain() {
    XCTAssertEqual(
      coloredLine("const mid = Math.floor(`lo` + 'x');", "javascript"),
      [["keyword", "const"], ["builtin", "Math"], ["string", "`lo`"], ["string", "'x'"]])
  }

  func testLeavesANameAfterADotPlainSinceItsAProperty() {
    XCTAssertEqual(
      coloredLine("console.log(event.type, list.delete)", "ts"), [["builtin", "console"]])
  }

  func testReadsSQLKeywordsInAnyCase() {
    XCTAssertEqual(
      coloredLine("select name FROM countries where pop > 200 -- big", "sql"),
      [
        ["keyword", "select"], ["keyword", "FROM"], ["keyword", "where"], ["number", "200"],
        ["comment", "-- big"],
      ])
  }

  func testColorsAnUnfinishedStringToTheEndOfTheLineWhileTheLearnerTypes() {
    XCTAssertEqual(coloredLine("WHERE continent = 'Asi", "sql").last, ["string", "'Asi"])
  }

  func testReadsTheNamesWritersGiveAFenceInAnyCase() {
    let python = coloredLine("def f(): return None", "python")

    XCTAssertEqual(coloredLine("def f(): return None", "py"), python)
    XCTAssertEqual(coloredLine("def f(): return None", "Python3"), python)
    XCTAssertEqual(coloredLine("let x = 1", "JS"), coloredLine("let x = 1", "javascript"))
  }

  func testColorsTypeScriptsOwnKeywordsAndTypesWhichJavaScriptLeavesPlain() {
    let code = "type Id = string; interface User { id: Id }"

    XCTAssertEqual(
      coloredLine(code, "typescript"),
      [["keyword", "type"], ["builtin", "string"], ["keyword", "interface"]])
    XCTAssertEqual(coloredLine(code, "javascript"), [])
  }

  func testColorsJavaAndCWithCsPreprocessorLines() {
    XCTAssertEqual(
      coloredLine("public static void main(String[] args) { int n = 2; }", "java"),
      [
        ["keyword", "public"], ["keyword", "static"], ["keyword", "void"], ["builtin", "String"],
        ["keyword", "int"], ["number", "2"],
      ])
    XCTAssertEqual(coloredLine("#include <stdio.h>", "c"), [["keyword", "#include"]])
    XCTAssertEqual(
      coloredLine(#"printf("%d\n", x); // print"#, "cpp"),
      [["builtin", "printf"], ["string", #""%d\n""#], ["comment", "// print"]])
  }

  func testColorsHTMLsTagsAndAttributeValuesNeverAnApostropheInItsText() {
    XCTAssertEqual(
      coloredLine("<a href=\"/home\">It's here</a> <!-- nav -->", "html"),
      [
        ["keyword", "a"], ["string", "\"/home\""], ["keyword", "a"], ["comment", "<!-- nav -->"],
      ])
  }

  func testColorsCSSsAtRulesNumbersWithUnitsAndComments() {
    XCTAssertEqual(
      coloredLine("@media (width > 40rem) { margin: -4px 50%; } /* wide */", "css"),
      [
        ["keyword", "@media"], ["number", "40rem"], ["number", "-4px"], ["number", "50%"],
        ["comment", "/* wide */"],
      ])
  }

  func testColorsNothingInProgramOutput() {
    XCTAssertEqual(coloredLine("It's 42 # not a comment", "text"), [])
    XCTAssertEqual(coloredLine("Total: 3 // done", "output"), [])
  }

  func testColorsOnlyStringsNumbersAndCommentsInALanguageItDoesntKnow() {
    XCTAssertEqual(
      coloredLine("fn main() { let s = \"oi\"; } // 2 items", "rust"),
      [["string", "\"oi\""], ["comment", "// 2 items"]])
    XCTAssertEqual(
      coloredLine("for x in [1, 2]:  # loop", nil),
      [["number", "1"], ["number", "2"], ["comment", "# loop"]])
    XCTAssertEqual(coloredLine("SELECT 1 -- one", nil), [["number", "1"], ["comment", "-- one"]])
  }

  func testDoesntTakeAURLADirectiveADecrementOrAnApostropheForACommentOrAString() {
    XCTAssertEqual(coloredLine("curl https://zoonk.com/api", "bash"), [])
    XCTAssertEqual(coloredLine("#include <math.h>", "objective-c"), [])
    XCTAssertEqual(coloredLine("i--;", nil), [])
    XCTAssertEqual(coloredLine("Don't stop, it's fine", nil), [])
  }

  /// Main's `code-breaks.test.tsx`.
  func testLetsALineSplitBeforeADotAndAfterAnOpeningBracketOrAComma() {
    let breaks = String(CodeBreaks.mark)

    XCTAssertEqual(
      CodeBreaks.inserted(into: "Promise.resolve('ok').then(log, 2);")
        .components(separatedBy: breaks),
      ["Promise", ".resolve(", "'ok')", ".then(", "log,", " 2);"])
    XCTAssertEqual(CodeBreaks.inserted(into: ".then()"), ".then()")
    XCTAssertEqual(CodeBreaks.inserted(into: "items[]"), "items[]")
  }

  func testSplitsWhereARunAfterAnOpeningBracketOrBeforeADotStarts() {
    XCTAssertTrue(CodeBreaks.breaks(between: "(", and: "'"))
    XCTAssertTrue(CodeBreaks.breaks(between: "e", and: "."))
    XCTAssertFalse(CodeBreaks.breaks(between: "(", and: ")"))
    XCTAssertFalse(CodeBreaks.breaks(between: "n", and: " "))
  }

  func testAWrappedLineKeepsItsIndentationInColumnsWithTabsAtFourColumnStops() {
    let line = CodeLineText(
      CodeHighlight.lines(of: "  \t  print(x)", language: "python")[0])

    XCTAssertEqual(line.indent, 6)
    XCTAssertEqual(line.runs.map(\.text).joined(), "print(x)")
    XCTAssertEqual(line.written, "  \t  print(x)")
  }
}
