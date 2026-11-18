import XCTest

@testable import Zoonk

final class GoalEntrySubmissionTests: XCTestCase {
  func testEmptyAndWhitespaceGoalsCannotBeSubmitted() {
    for words in ["", " ", "\n\t "] {
      XCTAssertFalse(GoalEntrySubmission.isEnabled(words: words, canSubmitEmpty: false))
    }
  }

  func testWordsAndMaterialWithAnIntentCanBeSubmitted() {
    XCTAssertTrue(GoalEntrySubmission.isEnabled(words: "Learn physics", canSubmitEmpty: false))
    XCTAssertTrue(GoalEntrySubmission.isEnabled(words: "", canSubmitEmpty: true))
  }
}
