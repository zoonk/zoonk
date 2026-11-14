import XCTest

@testable import Zoonk

/// Every day in another year names it (main's rule): a challenge moved past New Year, the next
/// mock's new day, and the day a mock or a memory happened.
final class PlanDateYearTests: XCTestCase {
  func testADayInAnotherYearNamesIt() {
    XCTAssertEqual(
      PlanDate.weekdayDay("2027-01-04", today: "2026-12-31"), "Monday, January 4, 2027")
    XCTAssertEqual(PlanDate.weekdayDay("2026-12-31", today: "2026-12-28"), "Thursday, December 31")
  }

  /// A week across New Year, or a month a year ahead, names the year too.
  func testARangeOrAMonthInAnotherYearNamesIt() {
    XCTAssertFalse(
      PlanDate.range(from: "2026-11-02", to: "2026-11-08", today: "2026-11-14").contains("2026"))
    XCTAssertTrue(
      PlanDate.range(from: "2026-12-28", to: "2027-01-03", today: "2027-01-05").contains("2026"))
    XCTAssertEqual(PlanDate.monthText("2026-05-01", today: "2026-11-14", wide: true), "May")
    XCTAssertEqual(PlanDate.monthText("2027-05-01", today: "2026-11-14", wide: true), "May 2027")
  }

  func testAMomentLastYearNamesItsYear() throws {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo")!
    let style = Date.FormatStyle(locale: Locale(identifier: "en_US"), timeZone: calendar.timeZone)
      .month(.abbreviated).day()
    let now = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 11, day: 14)))
    let lastYear = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2025, month: 11, day: 8)))
    let thisYear = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 8)))

    XCTAssertEqual(
      PlanDate.momentDay(lastYear, style: style, now: now, calendar: calendar), "Nov 8, 2025")
    XCTAssertEqual(
      PlanDate.momentDay(thisYear, style: style, now: now, calendar: calendar), "Nov 8")
  }
}
