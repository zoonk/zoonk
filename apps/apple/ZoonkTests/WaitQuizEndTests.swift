import XCTest

@testable import Zoonk

final class WaitQuizEndTests: XCTestCase {
  func testOnlyALostConnectionLeavesTheWaitGoing() {
    XCTAssertFalse(GenerationFailure.connection.endsWait)
    XCTAssertTrue(GenerationFailure.generation.endsWait)
    XCTAssertTrue(GenerationFailure.notStarted.endsWait)
  }
}
