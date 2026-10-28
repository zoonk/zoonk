import XCTest

@testable import Zoonk

final class CodeHighlightTests: XCTestCase {
  func testPythonColorsKeywordsBuiltinsLiteralsAndComments() {
    let line = CodeHighlight.tokenLines(
      of: #"for n in range(3): print("hi", 2)  # done"#, language: .python)[0]

    XCTAssertEqual(kinds(line, of: "for"), [.keyword])
    XCTAssertEqual(kinds(line, of: "range"), [.builtin])
    XCTAssertEqual(kinds(line, of: #""hi""#), [.string])
    XCTAssertEqual(kinds(line, of: "2"), [.number])
    XCTAssertEqual(kinds(line, of: "# done"), [.comment])
    XCTAssertEqual(kinds(line, of: "n"), [.plain])
  }

  func testAStringAcrossLinesColorsEachLine() {
    let lines = CodeHighlight.tokenLines(of: "s = \"\"\"one\ntwo\"\"\"\nx = 1", language: .python)

    XCTAssertEqual(lines.count, 3)
    XCTAssertEqual(kinds(lines[0], of: "\"\"\"one"), [.string])
    XCTAssertEqual(kinds(lines[1], of: "two\"\"\""), [.string])
    XCTAssertEqual(kinds(lines[2], of: "1"), [.number])
  }

  func testSQLWordsMatchInAnyCaseAndJavaScriptKeepsItsOwn() {
    let sql = CodeHighlight.tokenLines(of: "Select COUNT(*) from t -- all", language: .sql)[0]
    let javascript = CodeHighlight.tokenLines(of: "const x = `a` // b", language: .javascript)[0]

    XCTAssertEqual(kinds(sql, of: "Select"), [.keyword])
    XCTAssertEqual(kinds(sql, of: "COUNT"), [.builtin])
    XCTAssertEqual(kinds(sql, of: "-- all"), [.comment])
    XCTAssertEqual(kinds(javascript, of: "const"), [.keyword])
    XCTAssertEqual(kinds(javascript, of: "`a`"), [.string])
    XCTAssertEqual(kinds(javascript, of: "// b"), [.comment])
  }

  private func kinds(_ line: [(kind: CodeHighlight.Kind, text: String)], of text: String)
    -> [CodeHighlight.Kind]
  {
    line.filter { $0.text == text }.map(\.kind)
  }
}
