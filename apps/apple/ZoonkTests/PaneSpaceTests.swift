import XCTest

@testable import Zoonk

final class PaneSpaceTests: XCTestCase {
  func testWithoutAFoldThePanesSplitByTheirShares() {
    let panes = PaneSpace(width: 1000).panes(primaryShare: 0.55)

    XCTAssertEqual(panes, PaneSpace.Panes(primary: 550, gap: 0))
  }

  func testAnActiveFoldIsWhereThePanesMeetAndStaysClear() {
    let panes = PaneSpace(width: 868, fold: 455...495).panes(primaryShare: 0.55)

    XCTAssertEqual(panes, PaneSpace.Panes(primary: 455, gap: 40))
  }

  func testFlatOnTheDuoThePanesStillMeetAtTheHinge() {
    let space = PaneSpace(width: 867, hinge: 455.5...495.5)

    XCTAssertEqual(space.panes(primaryShare: 0.55), PaneSpace.Panes(primary: 455.5, gap: 40))
    XCTAssertNil(space.columnsAroundFold(minimum: 240, spacing: 24))
  }

  func testAnEvenSplitNeedsAPhoneWidthForEachPane() {
    XCTAssertNil(PaneSpace(width: 719).panes(primaryShare: 0.5))
    XCTAssertEqual(
      PaneSpace(width: 720).panes(primaryShare: 0.5), PaneSpace.Panes(primary: 360, gap: 0))
  }

  func testAMainAndSupportingSplitNeedsAPhoneWidthForTheSmallerPane() throws {
    XCTAssertNil(PaneSpace(width: 799).panes(primaryShare: 0.55))

    let panes = try XCTUnwrap(PaneSpace(width: 800).panes(primaryShare: 0.55))

    XCTAssertEqual(panes.primary, 440, accuracy: 0.001)
    XCTAssertEqual(panes.gap, 0)
  }

  func testTooNarrowStaysOneColumnEvenWithAFold() {
    XCTAssertNil(PaneSpace(width: 669, fold: 315...355).panes(primaryShare: 0.5))
  }

  func testAFoldThatLeavesAPaneUnderTheMinimumStaysSplit() {
    // Flat, each pane gets 380; folded, the trailing one narrows to 330 beside the vertical bar.
    let panes = PaneSpace(width: 760, fold: 390...430).panes(primaryShare: 0.5)

    XCTAssertEqual(panes, PaneSpace.Panes(primary: 390, gap: 40))
  }

  func testAGridHasNoFoldColumnsWithoutAFold() {
    XCTAssertNil(PaneSpace(width: 828).columnsAroundFold(minimum: 240, spacing: 24))
  }

  func testAGridAcrossTheFoldGetsOneColumnOnEachSideWithTheFoldBetween() {
    let columns = PaneSpace(width: 828, fold: 435...475).columnsAroundFold(
      minimum: 240, spacing: 24)

    XCTAssertEqual(
      columns,
      [PaneSpace.Column(width: 435, spacing: 40), PaneSpace.Column(width: 353, spacing: 0)])
  }

  func testAWideGridAcrossTheFoldGetsTheSameNumberOfColumnsOnEachSide() {
    // The narrower side fits two columns, so the wider one gets two as well.
    let columns = PaneSpace(width: 1100, fold: 560...600).columnsAroundFold(
      minimum: 200, spacing: 20)

    XCTAssertEqual(
      columns,
      [
        PaneSpace.Column(width: 270, spacing: 20), PaneSpace.Column(width: 270, spacing: 40),
        PaneSpace.Column(width: 240, spacing: 20), PaneSpace.Column(width: 240, spacing: 0),
      ])
  }
}
