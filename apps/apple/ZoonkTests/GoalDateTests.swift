import XCTest

@testable import Zoonk

final class GoalDateTests: XCTestCase {
  func testStartsTheDateScreenEmptyOnlyForADateThatPassedOrIsToday() {
    let noSitting = DateProblem.noSitting(month: "2027-02-01", closest: ["2027-01-10"])

    XCTAssertNil(GoalDate.kept("2026-10-01", problem: .passed))
    XCTAssertNil(GoalDate.kept("2026-10-30", problem: .today))
    XCTAssertEqual(GoalDate.kept("2027-02-14", problem: noSitting), "2027-02-14")
    XCTAssertEqual(GoalDate.kept("2027-02-14", problem: nil), "2027-02-14")
  }

  func testReadsAndWritesISODatesAsGregorianDaysWhateverTheDevicesCalendar() throws {
    let day = try XCTUnwrap(UnderstoodRows.day("2026-10-30"))

    XCTAssertEqual(Calendar(identifier: .gregorian).component(.year, from: day), 2026)
    XCTAssertEqual(isoDay(day), "2026-10-30")
    XCTAssertEqual(Calendar.isoLocal.identifier, .gregorian)
  }

  func testCountsTheGoalsTodayInItsZoneAndInUTCWithoutOne() throws {
    let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-30T01:00:00Z"))

    XCTAssertEqual(GoalDate.today(now: now, timeZone: "America/Sao_Paulo"), "2026-10-29")
    XCTAssertEqual(GoalDate.today(now: now, timeZone: nil), "2026-10-30")
    XCTAssertEqual(GoalDate.today(now: now, timeZone: "Not/AZone"), "2026-10-30")
  }
}
