import XCTest

@testable import Zoonk

final class RichTextBlockTests: XCTestCase {
  func testParagraphsKeepTheirLinesAndTablesSplitThem() {
    XCTAssertEqual(
      RichTextBlock.parse("First line\nsame paragraph\n\n| A | B |\n|---|---|\n| 1 | 2 |"),
      [
        .paragraph(lines: ["First line", "same paragraph"]),
        .table(header: ["A", "B"], alignments: [.leading, .leading], rows: [["1", "2"]]),
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
        .table(
          header: ["Price", "Shares"], alignments: [.leading, .trailing], rows: [["5", "10"]]),
        .paragraph(lines: ["7", "After"]),
      ])
    XCTAssertEqual(
      RichTextBlock.parse("| a | b |\n|---|\nrest"),
      [.paragraph(lines: ["| a | b |", "|---|", "rest"])])
  }

  func testAQuoteMarksOnlyTheFirstLineThatShowsItAsALineOfTheText() {
    let blocks = RichTextBlock.parse(
      "Prices move.\n\n- Rises **add** up.\n- Falls too.\n\nRises add up again.")
    let shown = { (text: String) in text.replacingOccurrences(of: "**", with: "") }

    XCTAssertEqual(
      RichTextBlock.mark("- Rises **add** up.", in: blocks, shown: shown),
      RichTextBlock.Mark(block: 1, item: 0, text: "Rises add up."))
    XCTAssertNil(RichTextBlock.mark("Falls back.", in: blocks, shown: shown))
  }
}
