import XCTest

@testable import Zoonk

final class MockResultChangeTests: XCTestCase {
  func testAChangeRoundsToTheNearestPoint() {
    XCTAssertEqual(result(net: 41.5, previous: 35).change, 7)
    XCTAssertEqual(result(irt: 487, previous: 520).change, -33)
  }

  func testAChangeThatRoundsToZeroIsLeftOut() {
    XCTAssertNil(result(net: 41.5, previous: 41.3).change)
    XCTAssertNil(result(net: 41.3, previous: 41.5).change)
  }

  func testAHalfPointRoundsUpAsOnMain() {
    XCTAssertEqual(result(net: 41.5, previous: 41).change, 1)
    XCTAssertNil(result(net: 41, previous: 41.5).change)
  }

  func testAFirstMockHasNoChange() {
    XCTAssertNil(result(net: 41.5, previous: nil).change)
  }

  private func result(net: Double? = nil, irt: Double? = nil, previous: Double?) -> MockResult {
    MockResult(
      areas: [], blank: 0, calibration: nil, coherence: nil, correct: 0,
      irt: irt.map { MockResult.IRT(high: $0, low: $0, score: $0) }, minutesUsed: 0,
      net: net.map {
        MockResult.Net(blank: 0, max: 60, net: $0, partial: 0, penalty: 0, right: 0, wrong: 0)
      },
      plannedMinutes: 0, preparation: nil, previous: previous, topics: [], total: 60,
      unansweredAtTimeout: 0)
  }
}
