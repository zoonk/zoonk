import XCTest

@testable import Zoonk

/// Main's `placement-test-phase.test.ts`: which screen a course's test shows, from a read or from a
/// part that closed, and where a learner who comes back picks up.
final class PlacementTestPhaseTests: XCTestCase {
  private let question = PracticeQuestion(itemId: "i1", format: .order, question: "Q?")

  func testWithNoTestOpenThePlanOffersOneAndOnboardingComesBackToItsResult() {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 5)
    result.attemptId = "a1"

    XCTAssertEqual(phase(attempt: nil, .asking, next: question), .offer)
    XCTAssertEqual(phase(attempt: nil, .done, result: result), .offer)
    XCTAssertEqual(
      phase(attempt: nil, .done, result: result, onboarding: true),
      .result(PlacementTestEnd(lessonsSkipped: 5, undoLessons: 5, attemptId: "a1")))
  }

  func testATestTheLearnerAskedForWaitsWhileItsCourseIsBuilt() {
    XCTAssertEqual(phase(attempt: nil, .preparing, onboarding: true), .offer)
    XCTAssertEqual(phase(attempt: nil, .preparing, onboarding: true, asked: true), .waiting)
    XCTAssertEqual(
      phase(attempt: nil, .waitingForQuestions, onboarding: true, asked: true), .waiting)
    XCTAssertEqual(
      phase(attempt: nil, .failed, onboarding: true, asked: true), .preparationFailed(nil),
      "A course that couldn't be built keeps the wait open to try again")
    XCTAssertEqual(
      phase(attempt: nil, .asking, next: question, asked: true), .unavailable,
      "A start that opened nothing has nothing to test")
  }

  func testAnOpenPartGoesOnAtItsNextQuestionWithItsPlaceInTheTest() {
    let open = attempt(part: 3, answered: 4)

    guard case .question(let asked) = phase(attempt: open, .asking, next: question) else {
      return XCTFail("Expected the question")
    }

    XCTAssertEqual(asked.question.itemId, "i1")
    XCTAssertEqual(asked.attempt, open, "Its answer carries the attempt and the part")
    XCTAssertEqual(asked.attempt.answered + 1, 5)
    XCTAssertEqual(asked.attempt.questions, 12)
  }

  func testAnOpenPartWaitsWhileItsQuestionsAreWritten() {
    XCTAssertEqual(phase(attempt: attempt(), .waitingForQuestions), .waiting)
    XCTAssertEqual(phase(attempt: attempt(), .preparing), .waiting)
  }

  func testAPartWhoseQuestionsCouldntBeWrittenKeepsTheWaitOpenToTryAgain() {
    let failed = phase(attempt: attempt(), .failed)

    XCTAssertEqual(failed, .preparationFailed(attempt()))
    XCTAssertTrue(failed.isWaiting, "Never a finished part")
    XCTAssertEqual(phase(attempt: attempt(), .unavailable), .unavailable)
  }

  func testAPartWithNothingLeftToAskClosesNext() {
    XCTAssertEqual(phase(attempt: attempt(), .done), .partOver(attempt()))
  }

  func testAFullTestWithPartsLeftReopensOnContinueYourTestInOnboardingAndOnThePlan() {
    let between = attempt(part: 3, partComplete: true, nextPart: 4)
    let stopped = attempt(part: 5, answered: 3, resume: .init(part: 5, question: 4))

    for onboarding in [false, true] {
      XCTAssertEqual(
        phase(attempt: between, .done, onboarding: onboarding), .continueTest(between))
      XCTAssertEqual(
        phase(attempt: stopped, .done, onboarding: onboarding), .continueTest(stopped))
    }

    XCTAssertEqual(
      plainFacts(PlacementTestCopy.standing(between)), ["Part 4 of 14", "About 1 hr 6 min left"],
      "Between parts it names the next part, never the one that closed")
    XCTAssertEqual(
      plainFacts(PlacementTestCopy.standing(stopped)), ["Part 5 of 14", "Question 4 of 12"],
      "A part stopped midway goes on at the question after the last answer")
  }

  func testAQuickTestThatEndedShowsItsResultWithTheRestOfTheCourseToTest() {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 2)
    result.attemptId = "a1"
    let ended = attempt(length: .quick, partComplete: true, partsLeft: 13)

    XCTAssertEqual(
      phase(attempt: ended, .done, result: result),
      .result(PlacementTestEnd(lessonsSkipped: 2, undoLessons: 2, attemptId: "a1", rest: ended)))
  }

  func testAClosedPartIsDoneOnlyOnceItsQuestionsAreExhausted() {
    let done = attempt(part: 3, partComplete: true, nextPart: 4)
    let stopped = attempt(part: 3, answered: 4, resume: .init(part: 3, question: 5))

    XCTAssertEqual(
      PlacementTestPhase(finished: end(done, part: 2, close: 2, change: "c"), attemptId: "a1"),
      .checkpoint(
        PlacementPartStop(attempt: done, partLessonsSkipped: 2, changeId: "c", undoLessons: 2)))
    XCTAssertEqual(
      PlacementTestPhase(finished: end(stopped, part: 1, close: 1), attemptId: "a1"),
      .stopped(PlacementPartStop(attempt: stopped, partLessonsSkipped: 1)))
  }

  func testTheLastPartCountsTheWholeTestAndItsUndoOnlyWhenItGivesThatBack() {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 40)
    result.heldUntilTomorrow = true
    result.nextLesson = .init(id: "l1", title: "Loops with for")

    XCTAssertEqual(
      PlacementTestPhase(
        finished: PlacementPartEnd(
          attempt: nil, lessonsSkipped: 12, partLessonsSkipped: 12, changeId: "change-2",
          result: result),
        attemptId: "a1"),
      .result(
        PlacementTestEnd(
          lessonsSkipped: 40, undoLessons: 12, heldUntilTomorrow: true,
          nextLesson: .init(id: "l1", title: "Loops with for"), attemptId: "a1")))

    let onePart = PlacementTestResult(finishedAt: .now, lessonsSkipped: 12)
    guard
      case .result(let end) = PlacementTestPhase(
        finished: PlacementPartEnd(
          attempt: nil, lessonsSkipped: 12, partLessonsSkipped: 12, changeId: "change-2",
          result: onePart),
        attemptId: "a1")
    else {
      return XCTFail("Expected the result")
    }

    XCTAssertEqual(end.changeId, "change-2")
  }

  func testAQuickTestsCloseShowsItsResultEvenWithTheCourseLeft() {
    let rest = attempt(length: .quick, partComplete: true, partsLeft: 13, remainingMinutes: 78)

    guard
      case .result(let end) = PlacementTestPhase(
        finished: end(rest, part: 3, close: 3, change: "c"), attemptId: "a1")
    else {
      return XCTFail("Expected the result")
    }

    XCTAssertEqual(end.rest, rest)
    XCTAssertEqual(
      plainFacts(PlacementTestCopy.partsLeftFacts(rest)), ["13 parts left", "About 1 hr 18 min"])
  }

  func testAnExhaustedLevelTestOutWaitsForItsResult() {
    let pending = levelTestOut(total: 8)
    XCTAssertEqual(
      LanguageTestPhase(testOut: pending),
      .finish(attemptID: pending.attemptId, completion: .testOut))
  }

  func testAnEmptyLevelTestOutAndASavedOutcomeAreTerminal() {
    let empty = levelTestOut(total: 0)
    let saved = levelTestOut(
      total: 8, result: .init(changeId: nil, finishedAt: .now, lessonsSkipped: 0))
    XCTAssertEqual(LanguageTestPhase(testOut: empty), .testOutResult(empty))
    XCTAssertEqual(LanguageTestPhase(testOut: saved), .testOutResult(saved))
  }

  func testALevelTestQuestionSaysItsNumberOfTheCeiling() {
    let reading = LevelTest.Question(
      id: "q5", options: ["A", "B", "C", "D"], passage: "Hola", question: "?", skill: .reading,
      audio: nil, audioPending: false)

    XCTAssertEqual(
      LanguageTestPhase(
        levelTest(answered: 4, next: .init(kind: "question", question: reading)), attemptID: "a1"),
      .question(attemptID: "a1", reading, selectsAll: false, number: 5, total: 12, canStop: false))
  }

  func testALevelTestOffersToStopOnlyOnceStoppingSavesALevel() {
    let reading = LevelTest.Question(
      id: "q4", options: ["A", "B", "C", "D"], passage: "Hola", question: "?", skill: .reading,
      audio: nil, audioPending: false)
    let next = LevelTest.Next(kind: "question", question: reading)

    XCTAssertEqual(
      LanguageTestPhase(levelTest(answered: 3, next: next, canStop: false), attemptID: "a1"),
      .question(attemptID: "a1", reading, selectsAll: false, number: 4, total: 12, canStop: false))
    XCTAssertEqual(
      LanguageTestPhase(levelTest(answered: 4, next: next, canStop: true), attemptID: "a1"),
      .question(attemptID: "a1", reading, selectsAll: false, number: 5, total: 12, canStop: true))
  }

  func testCantListenNowGoesStraightToTheResult() {
    XCTAssertNil(
      LanguageTestPhase(
        levelTest(answered: 6, next: .init(kind: "done", question: nil)), attemptID: "a1"),
      "Nothing more to ask: the test closes in the same save")
  }

  func testALevelTestLeftMidwayGoesOnAndAFinishedOneShowsItsResultInOnboardingOnly() {
    let listening = LevelTest.Question(
      id: "q6", options: ["A", "B", "C", "D"], passage: "Hola", question: "?", skill: .listening,
      audio: nil, audioPending: false)
    var open = levelTest(answered: 5, next: .init(kind: "question", question: listening))
    open.attemptId = "a1"

    XCTAssertEqual(
      LanguageTestPhase(opened: open, onboarding: false),
      .question(
        attemptID: "a1", listening, selectsAll: false, number: 6, total: 12, canStop: false))

    var finished = levelTest(answered: 6, next: .init(kind: "done", question: nil))
    finished.attemptId = "a1"
    finished.result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 0)
    finished.result?.attemptId = "a1"

    XCTAssertEqual(
      LanguageTestPhase(opened: finished, onboarding: true), .result(finished.result))
    XCTAssertEqual(LanguageTestPhase(opened: finished, onboarding: false), .offer(finished))
  }

  private func levelTest(answered: Int, next: LevelTest.Next, canStop: Bool? = nil) -> LevelTest {
    LevelTest(
      status: .ready, startedAt: nil, answered: answered, canStop: canStop, total: 12,
      estimatedMinutes: 6, levels: [], next: next)
  }

  private func levelTestOut(total: Int, result: LevelTestOut.Result? = nil) -> LevelTestOut {
    LevelTestOut(
      answered: total, attemptId: "a1", level: "B2", next: nil, preparing: false,
      result: result, total: total)
  }

  private func end(
    _ attempt: PlacementAttempt, part: Int, close: Int, change: String? = nil
  ) -> PlacementPartEnd {
    PlacementPartEnd(
      attempt: attempt, lessonsSkipped: close, partLessonsSkipped: part, changeId: change,
      result: nil)
  }

  private func attempt(
    length: PlacementLength = .wholeCourse, part: Int = 1, answered: Int = 0,
    partComplete: Bool = false, nextPart: Int? = nil, partsLeft: Int = 12,
    resume: PlacementAttempt.Resume? = nil, remainingMinutes: Int = 66
  ) -> PlacementAttempt {
    PlacementAttempt(
      answered: answered, chapter: "Variables and types", estimatedMinutes: 6, id: "a1",
      length: length, nextPart: nextPart, part: part, partComplete: partComplete, parts: 14,
      partsLeft: partsLeft, questions: 12, resume: resume, totalEstimatedMinutes: 85,
      remainingEstimatedMinutes: remainingMinutes)
  }

  private func phase(
    attempt: PlacementAttempt?, _ status: Components.Schemas.PlacementStatus,
    next: PracticeQuestion? = nil, result: PlacementTestResult? = nil, onboarding: Bool = false,
    asked: Bool = false
  ) -> PlacementTestPhase {
    PlacementTestPhase(
      attempt: attempt, result: result, status: status, next: next, labels: .trueFalse,
      onboarding: onboarding, asked: asked)
  }
}

/// Facts as a reader sees them: the formatters' no-break spaces read as spaces.
func plainFacts(_ facts: [String]) -> [String] {
  facts.map { $0.replacing(/[\u{00A0}\u{202F}]/, with: " ") }
}
