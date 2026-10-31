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
}
