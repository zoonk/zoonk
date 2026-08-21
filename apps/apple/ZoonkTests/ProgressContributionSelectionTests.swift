import CoreGraphics
import XCTest

@testable import Zoonk

final class ProgressContributionSelectionTests: XCTestCase {
  func testSelectionUsesTheNearestRecordedDayAcrossThePlot() {
    let sunday = ProgressContributionPoint(
      date: ProgressDate("2026-08-16")!,
      intensity: 1)
    let tuesday = ProgressContributionPoint(
      date: ProgressDate("2026-08-18")!,
      intensity: 2)
    let weeks = ProgressChartData.contributionWeeks(from: [sunday, tuesday])

    let selection = ProgressContributionSelection.nearestPoint(
      to: CGPoint(x: 16, y: 67),
      in: weeks,
      cellSize: 18,
      headerHeight: 20)

    XCTAssertEqual(selection, tuesday)
  }

  func testSelectionIgnoresTheMonthHeader() {
    let point = ProgressContributionPoint(
      date: ProgressDate("2026-08-16")!,
      intensity: 1)
    let weeks = ProgressChartData.contributionWeeks(from: [point])

    let selection = ProgressContributionSelection.nearestPoint(
      to: CGPoint(x: 9, y: 10),
      in: weeks,
      cellSize: 18,
      headerHeight: 20)

    XCTAssertNil(selection)
  }
}
