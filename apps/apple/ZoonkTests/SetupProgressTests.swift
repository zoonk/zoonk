import XCTest

@testable import Zoonk

final class SetupProgressTests: XCTestCase {
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
}
