import XCTest

@testable import Zoonk

final class LessonAskLayoutTests: XCTestCase {
  func testAPhoneLanguageExplanationKeepsItsOnlyAsk() {
    XCTAssertTrue(showsLessonAsk(isExplanation: true, hasPanel: true, hasOwnAsk: false))
  }

  func testAnExplanationWithItsOwnAskGetsNoSecondAsk() {
    XCTAssertFalse(showsLessonAsk(isExplanation: true, hasPanel: true, hasOwnAsk: true))
  }

  func testOtherScreensAndUnavailableTutorKeepTheirEntries() {
    XCTAssertTrue(showsLessonAsk(isExplanation: false, hasPanel: true, hasOwnAsk: true))
    XCTAssertFalse(showsLessonAsk(isExplanation: false, hasPanel: false, hasOwnAsk: false))
  }
}
