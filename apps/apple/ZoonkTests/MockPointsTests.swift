import XCTest
import ZoonkAPI

@testable import Zoonk

final class MockPointsTests: XCTestCase {
  private func test(_ name: String, met: Bool?) -> MockPoints.Test {
    MockPoints.Test(
      asked: 10, earned: 6, max: 10, met: met,
      minimum: PointsMinimum(unit: .points, value: 8), projected: nil,
      short: met == false ? 2 : nil,
      name: name, qualifying: false)
  }

  private func points(_ parts: [MockPoints.Test]) -> MockPoints {
    MockPoints(
      asked: 20, earned: 12, max: 20, met: nil, minimum: nil, projected: nil, short: nil,
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

  func testAWrittenMinimumNeverLetsTheResultSayEveryMinimumWasReached() {
    var result = points([test("Math", met: true), test("Writing", met: true)])
    result.written = [
      WrittenPartPoints(
        decimals: 0, max: 100, minimum: PointsMinimum(unit: .points, value: 50),
        name: "Discursive test", range: WritingRange(high: 64, low: 58), scale: .points,
        standing: .met, tasks: [])
    ]

    XCTAssertFalse(result.reachedEveryMinimum)
  }

  func testAWrittenStandingThisVersionDoesntKnowKeepsTheEstimate() throws {
    let wire = try JSONDecoder().decode(
      Components.Schemas.WrittenPartPoints.self,
      from: Data(
        #"{"max":100,"minimum":{"unit":"points","value":50},"name":"Discursive test","range":{"high":64,"low":58},"standing":"likelyMet","tasks":[]}"#
          .utf8))
    let part: WrittenPartPoints = try PracticeJSON.recode(wire)

    XCTAssertEqual(part.standing, .unrecognized)
    XCTAssertEqual(part.range, WritingRange(high: 64, low: 58))
  }

  func testAMinimumUnitOrScaleThisVersionDoesntKnowKeepsTheEstimate() throws {
    let wire = try JSONDecoder().decode(
      Components.Schemas.WrittenPartPoints.self,
      from: Data(
        #"{"max":100,"minimum":{"unit":"tenths","value":50},"name":"Discursive test","range":{"high":64,"low":58},"scale":"bands","standing":"met","tasks":[]}"#
          .utf8))
    let part: WrittenPartPoints = try PracticeJSON.recode(wire)

    XCTAssertNil(part.minimum)
    XCTAssertNil(part.scale)
    XCTAssertEqual(part.shownScale, .points)
    XCTAssertEqual(part.range, WritingRange(high: 64, low: 58))
  }

  func testAWrittenStandingKeepsTheResultFromSayingEveryMinimumWasReached() {
    var result = points([test("Math", met: true)])
    result.written = [
      WrittenPartPoints(
        decimals: 0, max: 100, minimum: nil, name: "Discursive test",
        range: WritingRange(high: 64, low: 58), scale: .points, standing: .met, tasks: [])
    ]

    XCTAssertFalse(result.reachedEveryMinimum)
  }
}
