import XCTest

@testable import Zoonk

/// Main's `placement-test-phase.test.ts`: which screen the test taken from the plan shows.
final class PlacementTestPhaseTests: XCTestCase {
  private let question = PracticeQuestion(itemId: "i1", format: .order, question: "Q?")

  func testWithNoTestOpenTheLearnerChoosesHowMuchToCheckWhateverOnboardingsState() {
    XCTAssertEqual(phase(attempt: nil, .asking, next: question), .choose)
    XCTAssertEqual(phase(attempt: nil, .preparing), .choose)
  }

  func testAnOpenTestGoesOnAtItsNextQuestion() {
    let open = attempt(part: 2)

    guard case .question(let asked) = phase(attempt: open, .asking, next: question, answered: 5)
    else {
      return XCTFail("Expected the question")
    }

    XCTAssertEqual(asked.question.itemId, "i1")
    XCTAssertEqual(asked.attempt, open, "Its answer carries the attempt and the part")
    XCTAssertEqual(asked.answered, 5)
  }

  func testAnOpenTestWaitsWhileItsQuestionsAreWritten() {
    XCTAssertEqual(phase(attempt: attempt(), .waitingForQuestions), .waiting)
    XCTAssertEqual(phase(attempt: attempt(), .preparing), .waiting)
  }

  func testAPartWithNothingLeftToAskClosesNext() {
    XCTAssertEqual(phase(attempt: attempt(), .done), .partOver(attempt()))
  }

  func testAPartClosedEarlierOffersTheNextOne() {
    let closed = attempt(partComplete: true)

    XCTAssertEqual(
      phase(attempt: closed, .asking, next: question), .between(closed, lessonsSkipped: nil))
  }

  func testAWholeCoursePartWithMoreToCheckSaysWhatItSkippedAndWhatsLeft() {
    let next = attempt(part: 2)
    let end = PlacementPartEnd(attempt: next, lessonsSkipped: 20, result: nil)

    XCTAssertEqual(
      PlacementTestPhase(finished: end, length: .wholeCourse), .between(next, lessonsSkipped: 20))
  }

  func testTheLastPartShowsTheWholeTestsResult() {
    let result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 40)
    let end = PlacementPartEnd(attempt: nil, lessonsSkipped: 12, result: result)

    XCTAssertEqual(
      PlacementTestPhase(finished: end, length: .wholeCourse),
      .result(length: .wholeCourse, lessonsSkipped: 40))
  }

  private func attempt(part: Int = 1, partComplete: Bool = false) -> PlacementAttempt {
    PlacementAttempt(
      estimatedMinutes: 12, id: "a1", length: .wholeCourse, part: part, partComplete: partComplete)
  }

  private func phase(
    attempt: PlacementAttempt?, _ status: Components.Schemas.PlacementStatus,
    next: PracticeQuestion? = nil, answered: Int = 0
  ) -> PlacementTestPhase {
    PlacementTestPhase(
      attempt: attempt, status: status, next: next, labels: .trueFalse, answered: answered,
      progress: 0.5)
  }
}
