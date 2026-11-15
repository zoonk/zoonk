import XCTest

@testable import Zoonk

/// The weekend's own time needs a weekend day and a weekday, as main's `getMissingDays`.
final class WeekendMissingDaysTests: XCTestCase {
  private typealias Missing = GoalPlan.WeekendMissingDays

  func testAWeekOfWeekdaysAndAWeekendDayNeedsNothing() {
    XCTAssertNil(Missing.of([0, 30, 30, 30, 30, 30, 45]))
  }

  func testAWeekWithoutSaturdayOrSundayNeedsAWeekendDay() {
    XCTAssertEqual(Missing.of([0, 30, 30, 30, 30, 30, 0]), .weekend)
  }

  func testAWeekOfWeekendDaysOnlyNeedsAWeekday() {
    XCTAssertEqual(Missing.of([45, 0, 0, 0, 0, 0, 45]), .weekdays)
  }
}
