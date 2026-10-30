import XCTest

@testable import Zoonk

final class UsernameStatusTests: XCTestCase {
  func testTheCurrentOrAnEmptyUsernameNeedsNoCheck() {
    XCTAssertEqual(UsernameStatus.of("ana", current: "ana", check: nil), .idle)
    XCTAssertEqual(UsernameStatus.of("", current: "ana", check: nil), .idle)
  }

  func testABadlyFormedUsernameIsInvalidWithoutAsking() {
    XCTAssertEqual(UsernameStatus.of("an", current: "ana", check: nil), .invalid)
    XCTAssertEqual(UsernameStatus.of("ana-b", current: "ana", check: nil), .invalid)
    XCTAssertEqual(
      UsernameStatus.of(String(repeating: "a", count: 31), current: "ana", check: nil), .invalid)
  }

  func testAnotherUsernameIsCheckingUntilItsOwnAnswerArrives() {
    let earlier = UsernameCheck(username: "ana_b", status: .available)

    XCTAssertEqual(UsernameStatus.of("ana_bc", current: "ana", check: nil), .checking)
    XCTAssertEqual(UsernameStatus.of("ana_bc", current: "ana", check: earlier), .checking)
    XCTAssertEqual(UsernameStatus.of("ana_b", current: "ana", check: earlier), .available)
    XCTAssertEqual(
      UsernameStatus.of(
        "bob", current: "ana", check: UsernameCheck(username: "bob", status: .taken)),
      .taken)
  }

  func testSavingWaitsForTheCheckAndRefusesWhatCantSave() {
    XCTAssertTrue(UsernameStatus.idle.canSave)
    XCTAssertTrue(UsernameStatus.available.canSave)
    XCTAssertFalse(UsernameStatus.checking.canSave)
    XCTAssertFalse(UsernameStatus.taken.canSave)
    XCTAssertFalse(UsernameStatus.invalid.canSave)
  }
}
