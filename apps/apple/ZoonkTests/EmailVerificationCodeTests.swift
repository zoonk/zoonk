import XCTest

@testable import Zoonk

final class EmailVerificationCodeTests: XCTestCase {
  func testRejectedCodeCannotBeSubmittedAgain() {
    var code = EmailVerificationCode()
    code.text = "123456"
    XCTAssertTrue(code.canSubmit)

    code.recordFailure(.invalidCode, for: code.normalized)

    XCTAssertFalse(code.canSubmit)
    XCTAssertEqual(code.displayedFailure(.invalidCode), .invalidCode)

    code.text = "123 456"
    XCTAssertFalse(code.canSubmit)
  }

  func testEditedCodeCanBeSubmitted() {
    var code = EmailVerificationCode()
    code.text = "123456"
    code.recordFailure(.invalidCode, for: code.normalized)

    code.text = "12345"
    XCTAssertFalse(code.canSubmit)
    XCTAssertNil(code.displayedFailure(.invalidCode))

    code.text = "123457"
    XCTAssertTrue(code.canSubmit)
  }

  func testNetworkFailureAllowsRetryingTheSameCode() {
    var code = EmailVerificationCode()
    code.text = "123456"

    code.recordFailure(.network, for: code.normalized)

    XCTAssertTrue(code.canSubmit)
    XCTAssertEqual(code.displayedFailure(.network), .network)
  }
}
