import XCTest

@testable import Zoonk

final class SetupProgressTests: XCTestCase {
  func testCountsTheAnsweredQuestionsAndTheOnesLeft() {
    XCTAssertEqual(
      SetupProgress(
        current: .schedule, history: [.purpose, .targetDate, .level],
        steps: [.schedule, .buddy, .placement, .plan]),
      SetupProgress(step: 4, total: 5))
  }

  func testKeepsAnEarlierQuestionsPlaceWhenALaterOneOpensItAgain() {
    XCTAssertEqual(
      SetupProgress(
        current: .targetDate, history: [.purpose, .targetDate, .level, .schedule],
        steps: [.schedule, .plan]),
      SetupProgress(step: 2, total: 4))
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
        current: .targetDate, history: [.purpose, .targetDate, .level, .schedule],
        steps: [.targetDate, .schedule, .plan]),
      SetupProgress(step: 2, total: 4))
  }
}
