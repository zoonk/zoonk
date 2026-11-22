import XCTest

@testable import Zoonk

final class RichTextTypographyTests: XCTestCase {
  func testLeavesInlineCodeAsWritten() throws {
    let text = try AttributedString(
      markdown: "`12000` is **12000**", options: .init(interpretedSyntax: .inlineOnly))

    XCTAssertEqual(
      String(
        RichTextTypography.typesetNumbers(in: text, locale: Locale(identifier: "en")).characters),
      "12000 is 12,000")
  }

  @MainActor
  func testARegexTaskKeepsItsNumbersAsWritten() {
    let task = "Match **codes** like 350000 or 94103-1234."

    XCTAssertEqual(
      String(LessonRichText.typeset(task, literalNumbers: true).text.characters),
      "Match codes like 350000 or 94103-1234.")
    XCTAssertNotEqual(LessonRichText.plain(task), "Match codes like 350000 or 94103-1234.")
  }
}
