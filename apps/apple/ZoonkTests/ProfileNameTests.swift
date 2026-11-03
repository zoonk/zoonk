import XCTest

@testable import Zoonk

final class ProfileNameTests: XCTestCase {
  func testAChangedNameFitsUpToTheLimit() {
    let longest = String(repeating: "a", count: ProfileName.maxLength)

    XCTAssertFalse(ProfileName.isChangeTooLong(longest, saved: "Ana"))
    XCTAssertFalse(ProfileName.isChangeTooLong(" \(longest) ", saved: "Ana"))
    XCTAssertTrue(ProfileName.isChangeTooLong(longest + "a", saved: "Ana"))
  }

  func testANameSavedBeforeTheLimitStaysUntilItChanges() {
    let saved = " \(String(repeating: "a", count: ProfileName.maxLength + 50)) "

    XCTAssertFalse(ProfileName.isChangeTooLong(saved, saved: saved))
    XCTAssertFalse(
      ProfileName.isChangeTooLong(saved.trimmingCharacters(in: .whitespaces), saved: saved))
    XCTAssertTrue(ProfileName.isChangeTooLong(saved + "b", saved: saved))
  }

  func testCountsCodePointsLikeTheServer() {
    let fits = String(repeating: "𠀀", count: ProfileName.maxLength)
    let tooLong = String(repeating: "𠀀", count: ProfileName.maxLength + 1)

    XCTAssertFalse(ProfileName.isChangeTooLong(fits, saved: "Ana"))
    XCTAssertTrue(ProfileName.isChangeTooLong(tooLong, saved: "Ana"))
  }
}
