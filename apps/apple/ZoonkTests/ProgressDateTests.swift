import Foundation
import XCTest

@testable import Zoonk

final class ProgressDateTests: XCTestCase {
  func testLogicalDateKeepsItsCalendarDayAcrossTimeZones() throws {
    let logicalDate = try XCTUnwrap(ProgressDate("2026-07-27"))

    for timeZoneIdentifier in ["Pacific/Kiritimati", "Pacific/Pago_Pago"] {
      let timeZone = try XCTUnwrap(TimeZone(identifier: timeZoneIdentifier))
      let date = try XCTUnwrap(logicalDate.date(in: timeZone))
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = timeZone

      XCTAssertEqual(calendar.component(.year, from: date), 2026)
      XCTAssertEqual(calendar.component(.month, from: date), 7)
      XCTAssertEqual(calendar.component(.day, from: date), 27)
    }
  }

  func testLogicalDateRejectsInvalidCalendarValues() {
    XCTAssertNil(ProgressDate("2026-02-30"))
    XCTAssertNil(ProgressDate("July 27, 2026"))
  }

  func testDaypartTimeRangesUseTheExpectedClockBoundaries() {
    let locale = Locale(identifier: "en_US")
    let expectedRanges = [
      "12:00 AM–6:00 AM",
      "6:00 AM–12:00 PM",
      "12:00 PM–6:00 PM",
      "6:00 PM–12:00 AM",
    ]

    XCTAssertEqual(
      ProgressDaypart.allCases.map {
        normalizedWhitespace($0.localizedTimeRange(locale: locale))
      },
      expectedRanges)
  }

  private func normalizedWhitespace(_ value: String) -> String {
    value.replacingOccurrences(
      of: #"\s+"#,
      with: " ",
      options: .regularExpression)
  }
}
