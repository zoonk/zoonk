import XCTest

@testable import Zoonk

final class ProgressChartDataTests: XCTestCase {
  func testActivityContributionIntensityUsesLearnerRelativeBands() {
    let days = [
      ActivityProgressDay(activitiesCompleted: 0, date: ProgressDate("2026-08-16")!),
      ActivityProgressDay(activitiesCompleted: 2, date: ProgressDate("2026-08-17")!),
      ActivityProgressDay(activitiesCompleted: 3, date: ProgressDate("2026-08-18")!),
      ActivityProgressDay(activitiesCompleted: 5, date: ProgressDate("2026-08-19")!),
      ActivityProgressDay(activitiesCompleted: 8, date: ProgressDate("2026-08-20")!),
    ]

    XCTAssertEqual(
      ProgressChartData.activityContributions(from: days).map(\.intensity),
      [0, 1, 2, 3, 4])
  }

  func testEnergyContributionIntensityUsesStableEnergyBands() {
    let values: [Double?] = [nil, 0, 1, 25, 26, 50, 51, 75, 76, 99, 100]
    let days = values.enumerated().map { index, energy in
      EnergyProgressDay(
        date: ProgressDate(String(format: "2026-08-%02d", index + 1))!,
        energy: energy)
    }

    XCTAssertEqual(
      ProgressChartData.energyContributions(from: days).map(\.intensity),
      [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5])
  }

  func testContributionWeeksAlignDatesFromSundayAndPreserveMissingDays() {
    let points = [
      ProgressContributionPoint(date: ProgressDate("2026-08-16")!, intensity: 1),
      ProgressContributionPoint(date: ProgressDate("2026-08-18")!, intensity: 2),
      ProgressContributionPoint(date: ProgressDate("2026-08-23")!, intensity: 3),
    ]

    let weeks = ProgressChartData.contributionWeeks(from: points)

    XCTAssertEqual(weeks.count, 2)
    XCTAssertEqual(weeks[0].startDate, ProgressDate("2026-08-16")!)
    XCTAssertEqual(weeks[0].slots.count, 7)
    XCTAssertEqual(weeks[0].slots[0].point, points[0])
    XCTAssertNil(weeks[0].slots[1].point)
    XCTAssertEqual(weeks[0].slots[2].point, points[1])
    XCTAssertEqual(weeks[1].slots.count, 1)
    XCTAssertEqual(weeks[1].slots[0].point, points[2])
  }

  func testContributionWeekFindsMonthLabelFromItsCalendarSlots() {
    let points = [
      ProgressContributionPoint(date: ProgressDate("2026-07-31")!, intensity: 1),
      ProgressContributionPoint(date: ProgressDate("2026-08-02")!, intensity: 2),
    ]

    let weeks = ProgressChartData.contributionWeeks(from: points)

    XCTAssertEqual(weeks.first?.monthLabelDate, ProgressDate("2026-08-01")!)
  }
}
