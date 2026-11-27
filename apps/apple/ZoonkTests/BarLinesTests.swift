import XCTest

@testable import Zoonk

/// A phone's bar shares its lines as main's and Android's do.
final class BarLinesTests: XCTestCase {
  private typealias Slot = BarLinesLayout.Slot

  private func lines(
    _ slots: [Slot], width: CGFloat, isWide: Bool = false, stacks: Bool = false
  ) -> [[Int]] {
    BarLinesLayout.lines(slots, width: width, gap: 8, isWide: isWide, stacks: stacks)
      .map { $0.map(\.0) }
  }

  private func widths(
    _ slots: [Slot], width: CGFloat, isWide: Bool = false, scale: CGFloat = 1
  ) -> [[CGFloat]] {
    BarLinesLayout.lines(slots, width: width, gap: 8, isWide: isWide, scale: scale)
      .map { $0.map(\.1) }
  }

  func testTheMainActionTakesWhatTheAnswerBesideItLeavesWithTheAskAfterIt() {
    let slots = [
      Slot(oneLine: 135), Slot(oneLine: 90, isMain: true), Slot(oneLine: 44, isGlyph: true),
    ]

    XCTAssertEqual(widths(slots, width: 358), [[135, 163, 44]])
  }

  func testALongerAnswerTakesTheLineAboveRatherThanLeavingTheMainActionSmaller() {
    let slots = [
      Slot(oneLine: 214), Slot(oneLine: 92, isMain: true), Slot(oneLine: 44, isGlyph: true),
    ]

    XCTAssertEqual(lines(slots, width: 358), [[0], [1, 2]])
    XCTAssertEqual(widths(slots, width: 358), [[358], [306, 44]])
  }

  func testTheAskNeverTakesALineAlone() {
    let slots = [
      Slot(oneLine: 141), Slot(oneLine: 141, isMain: true), Slot(oneLine: 44, isGlyph: true),
    ]

    XCTAssertEqual(lines(slots, width: 308), [[0], [1, 2]])
  }

  func testTwoLabeledButtonsOnALineWithoutTheMainActionShareIt() {
    let slots = [Slot(oneLine: 120), Slot(oneLine: 100), Slot(oneLine: 300, isMain: true)]

    XCTAssertEqual(widths(slots, width: 328), [[170, 150], [328]])
  }

  func testBesideAWayBackTheAnswerTakesTheLineAboveEvenWhereItWouldFit() {
    let slots = [
      Slot(oneLine: 44, isGlyph: true, isWayBack: true), Slot(oneLine: 135),
      Slot(oneLine: 90, isMain: true), Slot(oneLine: 44, isGlyph: true),
    ]

    XCTAssertEqual(lines(slots, width: 358), [[1], [0, 2, 3]])
    XCTAssertEqual(widths(slots, width: 358), [[358], [44, 254, 44]])
  }

  func testAWayBackWithOnlyTheMainActionSharesItsLine() {
    let slots = [
      Slot(oneLine: 44, isGlyph: true, isWayBack: true), Slot(oneLine: 90, isMain: true),
    ]

    XCTAssertEqual(widths(slots, width: 358), [[44, 306]])
  }

  func testEveryWidthIsWholePixelsSoNoLabelLosesAFractionOfItsLineToDrawing() {
    // "Stop for today" beside Continue in an iPhone Duo pane, at 3 pixels a point.
    let slots = [Slot(oneLine: 131.2), Slot(oneLine: 100.5, isMain: true)]

    let row = widths(slots, width: 351.4, scale: 3)

    XCTAssertEqual(row.count, 1)
    XCTAssertGreaterThanOrEqual(row[0][0], 131.2)
    for width in row[0] {
      XCTAssertEqual((width * 3).rounded(), width * 3, accuracy: 0.0001)
    }
  }

  func testOnAWideBarEachButtonKeepsItsOwnWidth() {
    let slots = [Slot(oneLine: 131), Slot(oneLine: 160, isMain: true)]

    XCTAssertEqual(widths(slots, width: 700, isWide: true), [[131, 160]])
  }

  func testOnAWideBarButtonsThatDontFitWrapRatherThanSqueeze() {
    let slots = [Slot(oneLine: 260), Slot(oneLine: 220), Slot(oneLine: 160, isMain: true)]

    XCTAssertEqual(widths(slots, width: 600, isWide: true), [[260, 220], [160]])
  }

  func testOnAWideBarTheAnswerStaysBesideAWayBack() {
    let slots = [
      Slot(oneLine: 44, isGlyph: true, isWayBack: true), Slot(oneLine: 135),
      Slot(oneLine: 160, isMain: true),
    ]

    XCTAssertEqual(lines(slots, width: 700, isWide: true), [[0, 1, 2]])
  }

  func testAtAccessibilitySizesEachLabeledButtonTakesALineWithTheAskBesideTheMainAction() {
    let slots = [
      Slot(oneLine: 100), Slot(oneLine: 90, isMain: true), Slot(oneLine: 44, isGlyph: true),
    ]

    XCTAssertEqual(lines(slots, width: 358, stacks: true), [[0], [1, 2]])
    XCTAssertEqual(
      BarLinesLayout.lines(slots, width: 358, gap: 8, stacks: true).map { $0.map(\.1) },
      [[358], [306, 44]])
  }

  func testAtAccessibilitySizesAWayBackKeepsItsRow() {
    let slots = [
      Slot(oneLine: 44, isGlyph: true, isWayBack: true), Slot(oneLine: 135),
      Slot(oneLine: 90, isMain: true),
    ]

    XCTAssertEqual(lines(slots, width: 358, stacks: true), [[1], [0, 2]])
  }
}
