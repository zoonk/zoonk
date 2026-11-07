import XCTest

@testable import Zoonk

final class StepSenderTests: XCTestCase {
  func testASkipsSaveSpinsOnlySkip() {
    var sender = StepSender()
    sender.press(.skip)

    XCTAssertTrue(sender.sent(.skip, isSaving: true))
    XCTAssertFalse(sender.sent(.proceed, isSaving: true))
  }

  func testAContinuesSaveSpinsOnlyContinue() {
    var sender = StepSender()
    sender.press(.proceed)

    XCTAssertTrue(sender.sent(.proceed, isSaving: true))
    XCTAssertFalse(sender.sent(.skip, isSaving: true))
  }

  func testASaveNoButtonStartedSpinsNeither() {
    var sender = StepSender()
    sender.press(.skip)
    sender.saveEnded()

    XCTAssertFalse(sender.sent(.skip, isSaving: true))
    XCTAssertFalse(sender.sent(.proceed, isSaving: true))
  }

  func testAPressThatSavesNothingSpinsNothing() {
    var sender = StepSender()
    sender.press(.proceed)

    XCTAssertFalse(sender.sent(.proceed, isSaving: false))
  }
}
