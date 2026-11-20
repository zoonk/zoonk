import XCTest

@testable import Zoonk

final class SetupProgressTests: XCTestCase {
  func testNoCountWhileAnAnswerCanAddQuestions() {
    XCTAssertNil(
      SetupProgress(current: .purpose, history: [], steps: [.purpose, .level, .plan]))
    XCTAssertNil(
      SetupProgress(current: .level, history: [], steps: [.level, .purpose, .plan]))
  }

  func testNoCountWhileTheLanguageReasonCanAddExamQuestions() {
    XCTAssertNil(
      SetupProgress(
        current: .reason, history: [.level, .followUps, .targetDate, .schedule], steps: [.plan]))
  }

  func testSkipAllOnlyWithMoreThanOneProfileQuestionLeft() {
    XCTAssertFalse(SetupProgress.showsSkipAll(current: .watch, steps: [.watch, .buddy, .plan]))
    XCTAssertTrue(
      SetupProgress.showsSkipAll(current: .watch, steps: [.watch, .listen, .buddy, .plan]))
    XCTAssertFalse(SetupProgress.showsSkipAll(current: .buddy, steps: [.buddy, .plan]))
  }

  /// Main's `getProfileProgress`: Skip all shows while another question about the learner is still
  /// ahead, whether or not the one on screen was answered before.
  func testSkipAllShowsOnARevisitedQuestionWhileAnotherIsAhead() {
    XCTAssertTrue(SetupProgress.showsSkipAll(current: .watch, steps: [.listen, .buddy, .plan]))
    XCTAssertFalse(SetupProgress.showsSkipAll(current: .listen, steps: [.buddy, .plan]))
  }

  func testCountsTheAnsweredQuestionsAndTheOnesLeft() {
    XCTAssertEqual(
      SetupProgress(
        current: .buddy, history: [.purpose, .level, .targetDate],
        steps: [.buddy, .placement, .schedule, .plan]),
      SetupProgress(step: 4, total: 5))
  }

  func testKeepsAnEarlierQuestionsPlaceWhenALaterOneOpensItAgain() {
    XCTAssertEqual(
      SetupProgress(
        current: .targetDate, history: [.purpose, .level, .targetDate, .schedule],
        steps: [.schedule, .plan]),
      SetupProgress(step: 3, total: 4))
  }

  func testAddsAQuestionTheLearnerNeverSawBeforeTheOneThatOpenedIt() {
    XCTAssertEqual(
      SetupProgress(
        current: .targetDate, history: [.target, .level, .schedule], steps: [.schedule, .plan]),
      SetupProgress(step: 3, total: 4))
  }

  func testKeepsAQuestionsPlaceWhenThePlanAsksItAgain() {
    XCTAssertEqual(
      SetupProgress(
        current: .targetDate, history: [.purpose, .level, .targetDate, .schedule],
        steps: [.targetDate, .schedule, .plan]),
      SetupProgress(step: 3, total: 4))
  }

  /// Main's `getSetupProgress`: the About you screens share one place in the setup's one count.
  func testAboutYouScreensShareOnePlaceInTheCount() {
    XCTAssertEqual(
      SetupProgress(
        current: .watch, history: [.purpose, .level, .work, .tools],
        steps: [.watch, .listen, .buddy, .schedule, .plan]),
      SetupProgress(step: 3, total: 5))
    XCTAssertEqual(
      SetupProgress(
        current: .buddy, history: [.purpose, .level, .work, .tools, .watch, .listen],
        steps: [.buddy, .schedule, .plan]),
      SetupProgress(step: 4, total: 5))
  }
}
