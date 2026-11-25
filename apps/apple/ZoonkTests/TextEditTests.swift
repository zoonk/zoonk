import XCTest

@testable import Zoonk

final class TextEditTests: XCTestCase {
  func testInsertionAtEndFitsOrIsRefused() {
    XCTAssertEqual(TextEdit(from: "abc", to: "abcd").fitted(to: 4).text, "abcd")
    XCTAssertEqual(TextEdit(from: "abc", to: "abcd").fitted(to: 3).text, "abc")
  }

  func testInsertionInFullFieldKeepsTheSuffixAndCaret() {
    let fitted = TextEdit(from: "abcdef", to: "abcXdef").fitted(to: 6)

    XCTAssertEqual(fitted.text, "abcdef")
    XCTAssertEqual(fitted.caret, 3)
  }

  func testOverflowingPasteUsesOnlyTheRoomAvailable() {
    let fitted = TextEdit(from: "abcd", to: "abXYZcd").fitted(to: 6)

    XCTAssertEqual(fitted.text, "abXYcd")
    XCTAssertEqual(fitted.caret, 4)
  }

  func testReplacingASelectionMakesRoomForNewText() {
    let fitted = TextEdit(from: "abcdef", to: "abXYZef").fitted(to: 6)

    XCTAssertEqual(fitted.text, "abXYef")
    XCTAssertEqual(fitted.caret, 4)
  }

  func testCaretDisambiguatesAnInsertionBesideIdenticalText() {
    let proposed = "abbbc"
    let caret = proposed.index(proposed.startIndex, offsetBy: 2)
    let fitted = TextEdit(from: "abbc", to: proposed, insertionEnd: caret).fitted(to: 4)

    XCTAssertEqual(fitted.text, "abbc")
    XCTAssertEqual(fitted.caret, 1)
  }

  func testEmojiAndComposedCharactersFitWholeOrStayOut() {
    XCTAssertEqual(TextEdit(from: "ab", to: "a😀b").fitted(to: 4).text, "a😀b")
    XCTAssertEqual(TextEdit(from: "ab", to: "a😀b").fitted(to: 3).text, "ab")
    XCTAssertEqual(TextEdit(from: "ab", to: "ae\u{301}b").fitted(to: 3).text, "ab")
    XCTAssertEqual(TextEdit(from: "ae", to: "ae\u{301}").fitted(to: 2).text, "ae")
    XCTAssertEqual(TextEdit(from: "", to: "😀👍🏽").fitted(to: 5).text, "😀")
  }

  func testGrowingAFamilyEmojiNeedsRoomForTheJoinerAndNextMember() {
    let edit = TextEdit(from: "👨‍👩", to: "👨‍👩‍👧")

    let refused = edit.fitted(to: 6)
    XCTAssertEqual(refused.text, "👨‍👩")
    XCTAssertEqual(refused.caret, 5)
    XCTAssertEqual(edit.fitted(to: 8).text, "👨‍👩‍👧")
  }

  func testGrowingAnEmojiKeepsTheWholeSkinToneModifier() {
    let edit = TextEdit(from: "a👍", to: "a👍🏽x")

    XCTAssertEqual(edit.fitted(to: 4).text, "a👍")
    XCTAssertEqual(edit.fitted(to: 5).text, "a👍🏽")
  }

  func testFittingUsesTheFlagBoundaryInTheProposedText() {
    let edit = TextEdit(from: "🇦", to: "🇦🇧🇨")

    XCTAssertEqual(edit.fitted(to: 4).text, "🇦🇧")
  }

  func testInsertionDoesNotKeepAClusterWithADanglingJoiner() {
    let edit = TextEdit(from: "a", to: "a👩‍x")

    XCTAssertEqual(edit.fitted(to: 4).text, "a")
  }

  func testOnlyNewDigitsFillTheRemainingRoom() {
    let fitted = TextEdit(from: "1234", to: "12a5 6²7834").fitted(to: 6, digitsOnly: true)

    XCTAssertEqual(fitted.text, "125634")
    XCTAssertEqual(fitted.caret, 4)
  }

  func testAnExistingOverLimitValueCanBeShortened() {
    XCTAssertEqual(TextEdit(from: "abcd", to: "acd").fitted(to: 2).text, "acd")
  }
}
