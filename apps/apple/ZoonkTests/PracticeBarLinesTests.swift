import XCTest

@testable import Zoonk

/// A phone's practice bar shares its lines as main's and Android's do.
final class PracticeBarLinesTests: XCTestCase {
  private typealias Slot = PracticeBarLines.Slot

  private func lines(_ slots: [Slot], width: CGFloat) -> [[Int]] {
    PracticeBarLines.lines(slots, width: width, gap: 8).map { $0.map(\.0) }
  }

  private func widths(_ slots: [Slot], width: CGFloat) -> [[CGFloat]] {
    PracticeBarLines.lines(slots, width: width, gap: 8).map { $0.map(\.1) }
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
}
