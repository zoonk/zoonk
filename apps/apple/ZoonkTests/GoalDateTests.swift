import XCTest

@testable import Zoonk

final class GoalDateTests: XCTestCase {
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
