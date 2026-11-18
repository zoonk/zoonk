import XCTest

@testable import Zoonk

/// The plan reveal lists today and the six days after it (core's `buildNextDaysView`), while the
/// plan carries its week from Monday to Sunday: what the reveal holds a place for while it loads.
final class PlanNextDaysTests: XCTestCase {
  private let weekdays = [0, 30, 30, 30, 30, 30, 0]

  func testAWeekdayLearnerStartingOnSaturdayHasNextWeeksLessons() throws {
    let plan = try weekPlan(today: "2027-01-09", lessonsOn: [])

    XCTAssertTrue(plan.hasLessonsInNextSevenDays)
  }

  func testAWeekdayLearnerStartingOnSundayHasNextWeeksLessons() throws {
    let plan = try weekPlan(today: "2027-01-10", lessonsOn: [])

    XCTAssertTrue(plan.hasLessonsInNextSevenDays)
  }

  func testLessonsLaterThisWeekCount() throws {
    let plan = try weekPlan(today: "2027-01-04", lessonsOn: ["2027-01-06"])

    XCTAssertTrue(plan.hasLessonsInNextSevenDays)
  }

  func testAPlanEndingBeforeNextWeeksStudyDaysHasNone() throws {
    let plan = try weekPlan(today: "2027-01-09", lessonsOn: [], estimateEnd: "2027-01-10")

    XCTAssertFalse(plan.hasLessonsInNextSevenDays)
  }

  func testAFinishedPlanHasNone() throws {
    let plan = try weekPlan(today: "2027-01-09", lessonsOn: [], end: "finished")

    XCTAssertFalse(plan.hasLessonsInNextSevenDays)
  }

  /// Its loading week holds Today's place only when today has lessons, as the loaded week shows it.
  func testARestDayHoldsNoPlaceForToday() throws {
    XCTAssertFalse(try weekPlan(today: "2027-01-09", lessonsOn: []).hasLessonsToday)
    XCTAssertTrue(try weekPlan(today: "2027-01-06", lessonsOn: ["2027-01-06"]).hasLessonsToday)
  }

  func testAMondayWithNothingLaidOutHasNone() throws {
    let plan = try weekPlan(today: "2027-01-04", lessonsOn: [])

    XCTAssertFalse(plan.hasLessonsInNextSevenDays)
  }

  /// The week of Monday, January 4, 2027, with lessons on the days named; the days before `today`
  /// come before the goal, so they hold nothing.
  private func weekPlan(
    today: String, lessonsOn: [String], estimateEnd: String = "2027-06-01", end: String? = nil
  ) throws -> GoalPlan {
    let days = (4...10).map { day in
      let date = "2027-01-\(String(format: "%02d", day))"
      let state = date == today ? "today" : date < today ? "rest" : "upcoming"
      let items = lessonsOn.contains(date) ? #"{"status": "todo"}"# : ""
      return #"{"date": "\#(date)", "items": [\#(items)], "state": "\#(state)"}"#
    }

    return try goalPlanFixture(
      estimateEnd: estimateEnd, end: end, today: "2027-01-04", weekdayMinutes: weekdays,
      weekDays: days)
  }
}
