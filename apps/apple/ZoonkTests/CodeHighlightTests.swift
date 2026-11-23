import XCTest

@testable import Zoonk

final class CodeHighlightTests: XCTestCase {
  func testKeepsTheTextOfEveryLineExactlyIncludingIndentation() {
    let code = "total = 0\nfor n in range(3):\n    total += n\n\tprint(total)  "

    XCTAssertEqual(
      CodeHighlight.lines(of: code, language: "python").map { $0.map(\.text).joined() },
      code.components(separatedBy: "\n"))
  }

  func testKeepsEmptyLines() {
    XCTAssertEqual(CodeHighlight.lines(of: "a = 1\n\nb = 2", language: "python").count, 3)
  }

  func testAWrappedLineKeepsItsIndentationInColumnsWithTabsAtFourColumnStops() {
    let line = CodeLineText(
      CodeHighlight.lines(of: "  \t  print(x)", language: "python")[0])

    XCTAssertEqual(line.indent, 6)
    XCTAssertEqual(line.runs.map(\.text).joined(), "print(x)")
    XCTAssertEqual(line.written, "  \t  print(x)")
  }
}
