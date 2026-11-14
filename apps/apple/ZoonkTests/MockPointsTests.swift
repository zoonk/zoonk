import XCTest

@testable import Zoonk

final class MockPointsTests: XCTestCase {
  private func test(_ name: String, met: Bool?) -> MockPoints.Test {
    MockPoints.Test(
      asked: 10, earned: 6, max: 10, met: met,
      minimum: PointsMinimum(unit: .points, value: 8), projected: nil,
      short: met == false ? 2 : nil,
      name: name, qualifying: false)
  }

  private func points(_ parts: [MockPoints.Test], minimum: PointsMinimum? = nil) -> MockPoints {
    MockPoints(
      asked: 20, earned: 12, max: 20, met: nil, minimum: minimum, projected: nil, short: nil,
      parts: parts, unjudged: [])
  }

  func testAMissedMinimumTakesTheHeadlineAndKeepsTheTotalInItsRows() {
    let result = points([test("Math", met: true), test("Writing", met: false)])

    XCTAssertEqual(result.tests.map(\.name), ["Writing", "Math", nil])
    XCTAssertEqual(result.missedMinimum?.title, "Below the minimum in Writing")
    XCTAssertFalse(result.reachedEveryMinimum)
  }

  func testEveryMinimumReachedLeavesTheTotalOutWithoutItsOwnMinimum() {
    let result = points([test("Math", met: true), test("Writing", met: true)])

    XCTAssertEqual(result.tests.map(\.name), ["Math", "Writing"])
    XCTAssertNil(result.missedMinimum)
    XCTAssertTrue(result.reachedEveryMinimum)
  }

  func testUnjudgedMinimumsReachNothing() {
    let result = points([test("Math", met: nil)])

    XCTAssertFalse(result.reachedEveryMinimum)
    XCTAssertNil(result.missedMinimum)
  }
}
