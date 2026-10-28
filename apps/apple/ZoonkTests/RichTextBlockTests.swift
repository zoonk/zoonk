import XCTest

@testable import Zoonk

final class RichTextBlockTests: XCTestCase {
  func testParagraphsKeepTheirLinesAndTablesSplitThem() {
    XCTAssertEqual(
      RichTextBlock.parse("First line\nsame paragraph\n\n| A | B |\n|---|---|\n| 1 | 2 |"),
      [
        .paragraph(lines: ["First line", "same paragraph"]),
        .table(header: ["A", "B"], rows: [["1", "2"]]),
      ])
  }

  func testListsLoseTheirMarkersAndEndAtOtherText() {
    let text = """
      Owning shares gives you:

      - A part of the **profit**
      * A vote
      • A slice of the future

      1. First
      2) Second
      It doesn't give you a guaranteed return.
      """

    XCTAssertEqual(
      RichTextBlock.parse(text),
      [
        .paragraph(lines: ["Owning shares gives you:"]),
        .list(
          items: ["A part of the **profit**", "A vote", "A slice of the future"], ordered: false),
        .list(items: ["First", "Second"], ordered: true),
        .paragraph(lines: ["It doesn't give you a guaranteed return."]),
      ])
  }

  func testATableNeedsADelimiterRowWithItsCellsAndPadsShortRows() {
    XCTAssertEqual(
      RichTextBlock.parse("Price | Shares\n:--- | ---:\n5 | 10\n7\nAfter"),
      [
        .table(header: ["Price", "Shares"], rows: [["5", "10"]]),
        .paragraph(lines: ["7", "After"]),
      ])
    XCTAssertEqual(
      RichTextBlock.parse("| a | b |\n|---|\nrest"),
      [.paragraph(lines: ["| a | b |", "|---|", "rest"])])
  }
}
