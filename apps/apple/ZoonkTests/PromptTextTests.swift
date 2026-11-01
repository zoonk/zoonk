import XCTest

@testable import Zoonk

final class PromptTextTests: XCTestCase {
  func testASentenceInQuotesLosesThemUnlessQuotesInsideWouldStandAlone() {
    XCTAssertEqual(PromptText.stripWrappingQuotes("  \"hello there\"  "), "hello there")
    XCTAssertEqual(PromptText.stripWrappingQuotes("“hello there”"), "hello there")
    XCTAssertEqual(PromptText.stripWrappingQuotes("\"hello there"), "\"hello there")
    XCTAssertEqual(
      PromptText.stripWrappingQuotes("He said \"wait\" and left."),
      "He said \"wait\" and left.")
    XCTAssertEqual(PromptText.stripWrappingQuotes("\""), "\"")
    XCTAssertEqual(PromptText.stripWrappingQuotes("'It's ready'"), "It's ready")
    XCTAssertEqual(PromptText.stripWrappingQuotes("‘It’s ready’"), "It’s ready")
    let quoted = "\"this\" should preserve quotes in the first and last \"words\""
    XCTAssertEqual(PromptText.stripWrappingQuotes(quoted), quoted)
  }
}
