import XCTest

@testable import Zoonk

/// A tapped day keeps a 44pt target, and neighbors closer than that split the room between them.
final class WeekDaysRowTests: XCTestCase {
  func testATappedDayKeepsA44PointTargetWhereTheDaysHaveRoom() {
    // iPhone SE's column: the rings' centers are 52.8pt apart.
    XCTAssertEqual(WeekDaysRow.dayWidth(rowWidth: 343, markWidth: 26, days: 7, target: 44), 44)
  }

  func testNeighborsCloserThanTheTargetSplitTheRoomBetweenThem() {
    XCTAssertEqual(WeekDaysRow.dayWidth(rowWidth: 260, markWidth: 26, days: 7, target: 44), 39)
  }

  func testADayNotTappedTakesTheRoomToItsNeighbors() {
    XCTAssertEqual(
      WeekDaysRow.dayWidth(rowWidth: 343, markWidth: 36, days: 7, target: nil), 307.0 / 6)
  }
}
