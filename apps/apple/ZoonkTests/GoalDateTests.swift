import XCTest

@testable import Zoonk

final class GoalDateTests: XCTestCase {
  func testReadsAndWritesISODatesAsGregorianDaysWhateverTheDevicesCalendar() throws {
    let day = try XCTUnwrap(UnderstoodRows.day("2026-10-30"))

    XCTAssertEqual(Calendar(identifier: .gregorian).component(.year, from: day), 2026)
    XCTAssertEqual(isoDay(day), "2026-10-30")
    XCTAssertEqual(Calendar.isoLocal.identifier, .gregorian)
  }

  func testWritesThePickedDayInTheLearnersZone() throws {
    let tokyoMidnight = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-03-20T15:00:00Z"))
    let saoPauloEvening = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-03-22T00:00:00Z"))

    inTimeZone("Asia/Tokyo") { XCTAssertEqual(isoDay(tokyoMidnight), "2026-03-21") }
    inTimeZone("America/Sao_Paulo") { XCTAssertEqual(isoDay(saoPauloEvening), "2026-03-21") }
  }

  func testCountsTheGoalsTodayInItsZoneAndInUTCWithoutOne() throws {
    let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-30T01:00:00Z"))

    XCTAssertEqual(GoalDate.today(now: now, timeZone: "America/Sao_Paulo"), "2026-10-29")
    XCTAssertEqual(GoalDate.today(now: now, timeZone: nil), "2026-10-30")
    XCTAssertEqual(GoalDate.today(now: now, timeZone: "Not/AZone"), "2026-10-30")
  }

  /// `TimeZone.current` ignores `NSTimeZone.default`, so the device's zone is moved through `TZ`.
  private func inTimeZone(_ identifier: String, _ body: () -> Void) {
    let home = ProcessInfo.processInfo.environment["TZ"]
    setenv("TZ", identifier, 1)
    NSTimeZone.resetSystemTimeZone()

    defer {
      if let home {
        setenv("TZ", home, 1)
      } else {
        unsetenv("TZ")
      }

      NSTimeZone.resetSystemTimeZone()
    }

    XCTAssertEqual(TimeZone.current.identifier, identifier)
    body()
  }
}
