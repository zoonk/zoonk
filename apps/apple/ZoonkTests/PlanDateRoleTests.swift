import XCTest

@testable import Zoonk

/// Where a date sits decides how it's written (main's `DateRole`): a data row's date is short, a
/// sentence's is long, a month likewise, and a date in another year than today's names it. A screen
/// asks by role, so one date reads the same on every screen.
final class PlanDateRoleTests: XCTestCase {
  private let today = "2026-11-16"

  func testEachRoleWritesItsDateOneWay() {
    XCTAssertEqual(PlanDate.format("2026-11-20", .row, today: today), "Nov 20")
    XCTAssertEqual(PlanDate.format("2026-11-20", .sentence, today: today), "November 20")
    XCTAssertEqual(PlanDate.format("2026-12-01", .rowMonth, today: today), "Dec")
    XCTAssertEqual(PlanDate.format("2026-12-01", .sentenceMonth, today: today), "December")
    XCTAssertEqual(PlanDate.format("2026-11-20", .weekday, today: today), "Friday")
  }

  func testAWeekdayIsShortInARowAndLongInASentence() {
    XCTAssertEqual(PlanDate.format("2026-11-20", .row, today: today, weekday: true), "Fri, Nov 20")
    XCTAssertEqual(
      PlanDate.format("2026-11-20", .sentence, today: today, weekday: true), "Friday, November 20")
  }

  func testTheYearShowsInAnotherYearOrWhenAskedFor() {
    XCTAssertEqual(PlanDate.format("2027-02-18", .row, today: today), "Feb 18, 2027")
    XCTAssertEqual(PlanDate.format("2027-07-01", .rowMonth, today: today), "Jul 2027")
    XCTAssertEqual(PlanDate.format("2026-11-20", .row, today: today, year: .always), "Nov 20, 2026")
    XCTAssertEqual(PlanDate.format("2027-02-18", .row, today: today, year: .never), "Feb 18")
    XCTAssertEqual(PlanDate.format("2027-02-18", .weekday, today: today), "Thursday")
  }

  /// The older helpers are the roles under other names, so their dates agree with the table.
  func testTheNamedHelpersAreRoles() {
    XCTAssertEqual(PlanDate.text("2027-02-18", today: today), "Feb 18, 2027")
    XCTAssertEqual(PlanDate.longDay("2026-11-20", today: today), "November 20")
    XCTAssertEqual(PlanDate.weekdayDay("2026-11-20", today: today), "Friday, November 20")
    XCTAssertEqual(PlanDate.monthText("2027-07-01", today: today), "Jul 2027")
    XCTAssertEqual(PlanDate.monthText("2027-07-01", today: today, wide: true), "July 2027")
  }

  /// A time of day in the device's own clock: 12-hour in the United States, 24-hour in Brazil.
  func testATimeOfDayFollowsTheLocalesClock() {
    XCTAssertEqual(
      PlanDate.timeOfDay(minutes: 7 * 60 + 30, locale: Locale(identifier: "en_US")),
      "7:30\u{202F}AM")
    XCTAssertEqual(
      PlanDate.timeOfDay(minutes: 19 * 60 + 5, locale: Locale(identifier: "pt_BR")), "19:05")
  }
}
