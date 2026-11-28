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

  /// Main's `coloredLine`: the line's colored runs, without the plain ones.
  private func colored(_ line: String, _ language: String) -> [String] {
    CodeHighlight.lines(of: line, language: language)[0]
      .filter { $0.kind != .plain }
      .map { "\($0.kind) \($0.text)" }
  }

  func testColorsEveryLanguageTheCodeRunnerRunsOnAServerAsMainDoes() {
    XCTAssertEqual(
      colored(#"Console.WriteLine($"Hi {name}"); // C#"#, "csharp"),
      ["builtin Console", #"string $"Hi {name}""#, "comment // C#"])
    XCTAssertEqual(
      colored("func main() { fmt.Println(`raw`) }", "go"),
      ["keyword func", "builtin fmt", "string `raw`"])
    XCTAssertEqual(
      colored(#"let mut n: i32 = 2; println!("{n}");"#, "rust"),
      [
        "keyword let", "keyword mut", "builtin i32", "number 2", "builtin println",
        #"string "{n}""#,
      ])
    XCTAssertEqual(
      colored(#"let total: Int = 3; print("\(total)")"#, "swift"),
      ["keyword let", "builtin Int", "number 3", "builtin print", #"string "\(total)""#])
    XCTAssertEqual(
      colored("fun main() { val c = 'x'; println(c) }", "kotlin"),
      ["keyword fun", "keyword val", "string 'x'", "builtin println"])
    XCTAssertEqual(
      colored("<?php echo strlen($name); # PHP", "php"),
      ["keyword <?php", "keyword echo", "builtin strlen", "comment # PHP"])
    XCTAssertEqual(
      colored(#"def greet = puts "hi" # Ruby"#, "ruby"),
      ["keyword def", "builtin puts", #"string "hi""#, "comment # Ruby"])
  }

  func testARustLifetimeIsANameNotAStringToTheLinesEnd() {
    XCTAssertEqual(
      colored("fn first<'a>(s: &'a str) -> char { 'x' }", "rust"),
      ["keyword fn", "builtin str", "builtin char", "string 'x'"])
  }
}
