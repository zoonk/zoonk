import XCTest

@testable import Zoonk

/// Main's `spoken-code.test.ts`: VoiceOver keeps code's lines and their indentation apart, so a
/// program whose `print` is indented under its `for` and one where it isn't read differently.
final class SpokenCodeTests: XCTestCase {
  func testReadsALinesIndentationApartFromItsCode() {
    let line = SpokenCodeLine("    print(fruta)")
    XCTAssertEqual(line.code, "print(fruta)")
    XCTAssertEqual(line.indent, [SpokenCodeLine.Run(count: 4, isTab: false)])
    XCTAssertEqual(
      SpokenCodeLine("\t\t  return n").indent,
      [SpokenCodeLine.Run(count: 2, isTab: true), SpokenCodeLine.Run(count: 2, isTab: false)])
    XCTAssertEqual(SpokenCodeLine("   ").indent, [])
  }

  func testAnIndentedOptionAndAnUnindentedOneReadApart() {
    XCTAssertEqual(
      SpokenCode.snippet("for fruta in frutas:\n    print(fruta)"),
      "Line 1: for fruta in frutas: Line 2, indented 4 spaces: print(fruta)")
    XCTAssertEqual(
      SpokenCode.snippet("for fruta in frutas:\nprint(fruta)"),
      "Line 1: for fruta in frutas: Line 2: print(fruta)")
    XCTAssertEqual(SpokenCode.snippet("print(frutas)"), "print(frutas)")
    XCTAssertEqual(SpokenCode.snippet("\tprint(frutas)"), "Indented 1 tab: print(frutas)")
  }

  func testReadsABlocksLinesWithTheirNumbers() {
    XCTAssertEqual(SpokenCode.line("", number: 2), "Line 2: blank")
    XCTAssertEqual(
      SpokenCode.line("\tprint(frutas)", number: 3), "Line 3, indented 1 tab: print(frutas)")
  }

  func testKeepsAShortWordOfInlineCodeWholeAndSplitsOnlyALongOne() {
    XCTAssertEqual(
      CodeBreaks.insertedInLongWords(into: "print(fruta) e for i in range(3):"),
      "print(fruta) e for i in range(3):")
    XCTAssertEqual(
      CodeBreaks.insertedInLongWords(into: "x = numeros.append(valor_muito_grande)")
        .replacingOccurrences(of: "\u{200B}", with: "|"),
      "x = numeros|.append(|valor_muito_grande)")
  }
}
