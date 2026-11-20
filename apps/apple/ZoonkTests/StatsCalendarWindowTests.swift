import XCTest

@testable import Zoonk

final class StatsCalendarWindowTests: XCTestCase {
  func testCompactAndNarrowPanesShowSixMonths() {
    for (width, compact) in [(700.0, true), (343.0, false), (580.0, false)] {
      let window = StatsCalendarWindow(width: width, compact: compact, availableWeeks: 53)
      XCTAssertEqual(window.weeks, 26)
      XCTAssertEqual(window.months, 6)
    }
  }

  func testWidePanesShowTwelveMonths() {
    let window = StatsCalendarWindow(width: 800, compact: false, availableWeeks: 53)
    XCTAssertEqual(window.weeks, 52)
    XCTAssertEqual(window.months, 12)
  }
}
