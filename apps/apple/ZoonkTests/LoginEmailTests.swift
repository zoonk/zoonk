import XCTest

@testable import Zoonk

/// A wrong email says what's wrong under its field once the learner leaves it or presses Continue,
/// as main's login says it on Continue, and goes as soon as it's fixed.
final class LoginEmailTests: XCTestCase {
  func testAnEmailStillBeingTypedSaysNothing() {
    var email = LoginEmail()
    email.text = "a@b"

    XCTAssertNil(email.failure)
  }

  func testLeavingAWrongEmailSaysWhatsWrong() {
    var email = LoginEmail()
    email.text = "a@b"
    email.leave()

    XCTAssertEqual(email.failure, .invalidEmail)
  }

  func testContinueWithAWrongEmailSaysWhatsWrongAndSendsNothing() {
    var email = LoginEmail()
    email.text = "a@b"

    XCTAssertFalse(email.submit())
    XCTAssertEqual(email.failure, .invalidEmail)
  }

  func testFixingTheEmailTakesTheLineAway() {
    var email = LoginEmail()
    email.text = "a@b"
    email.leave()
    email.text = "a@b.co"

    XCTAssertNil(email.failure)
    XCTAssertTrue(email.submit())
  }

  func testLeavingAnEmptyFieldSaysNothing() {
    var email = LoginEmail()
    email.leave()

    XCTAssertNil(email.failure)
  }
}
