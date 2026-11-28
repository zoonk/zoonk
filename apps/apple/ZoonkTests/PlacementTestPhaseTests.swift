import XCTest

@testable import Zoonk

/// Main's `placement-test-phase.test.ts`: which screen a course's test shows, from a read or from
/// its finish, and where a learner who comes back picks up.
final class PlacementTestPhaseTests: XCTestCase {
  private let question = PracticeQuestion(itemId: "i1", format: .order, question: "Q?")

  func testWithNoTestOpenThePlanOffersOneAndOnboardingComesBackToItsResult() {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 5)
    result.attemptId = "a1"
    result.chapter = "Why prices move"
    result.course = course

    XCTAssertEqual(phase(attempt: nil, .asking, next: question), .offer)
    XCTAssertEqual(phase(attempt: nil, .done, result: result), .offer)
    XCTAssertEqual(
      phase(attempt: nil, .done, result: result, onboarding: true),
      .result(
        PlacementTestEnd(
          lessonsSkipped: 5, chapter: "Why prices move", course: course, attemptId: "a1")))
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

  func testAnOpenTestGoesOnAtItsNextQuestionInOnboardingAndOnThePlan() {
    let open = attempt(answered: 4)

    for onboarding in [false, true] {
      guard
        case .question(let asked) = phase(
          attempt: open, .asking, next: question, onboarding: onboarding)
      else {
        return XCTFail("Expected the question")
      }

      XCTAssertEqual(asked.question.itemId, "i1")
      XCTAssertEqual(asked.attempt, open, "Its answer carries the attempt")
    }
  }

  func testAnOpenTestWaitsWhileItsQuestionsAreWritten() {
    XCTAssertEqual(phase(attempt: attempt(), .waitingForQuestions), .waiting)
    XCTAssertEqual(phase(attempt: attempt(), .preparing), .waiting)
  }

  func testATestWhoseQuestionsCouldntBeWrittenKeepsTheWaitOpenToTryAgain() {
    let failed = phase(attempt: attempt(), .failed)

    XCTAssertEqual(failed, .preparationFailed(attempt()))
    XCTAssertTrue(failed.isWaiting, "Never a finished test")
    XCTAssertEqual(phase(attempt: attempt(), .unavailable), .unavailable)
  }

  func testATestWithNothingLeftToAskFinishesNext() {
    XCTAssertEqual(phase(attempt: attempt(), .done), .over(attempt()))
  }

  func testARefusedAnswerIsReadAgainAndAStoppedTestShowsItsResult() {
    let asked = PlacementTestQuestion(
      attempt: attempt(answered: 1), question: question, labels: .trueFalse)
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 3)
    result.attemptId = "a1"
    result.chapter = "Why prices move"
    let next = PracticeQuestion(itemId: "i2", format: .order, question: "Next?")

    XCTAssertNil(
      PlacementTestPhase(
        refused: asked, attempt: attempt(answered: 1), result: nil, status: .asking,
        next: question, labels: .trueFalse, onboarding: false),
      "A read that still asks the question means the answer didn't save")

    for onboarding in [false, true] {
      XCTAssertEqual(
        PlacementTestPhase(
          refused: asked, attempt: nil, result: result, status: .unavailable, next: nil,
          labels: .trueFalse, onboarding: onboarding),
        .result(PlacementTestEnd(read: result)),
        "Another device stopped this test: its result shows, on the plan too")
    }

    guard
      case .question(let moved) = PlacementTestPhase(
        refused: asked, attempt: attempt(answered: 2), result: nil, status: .asking, next: next,
        labels: .trueFalse, onboarding: false)
    else {
      return XCTFail("Expected the question another device moved to")
    }
    XCTAssertEqual(moved.question.itemId, "i2")

    var older = result
    older.attemptId = "a0"
    XCTAssertEqual(
      PlacementTestPhase(
        refused: asked, attempt: nil, result: older, status: .unavailable, next: nil,
        labels: .trueFalse, onboarding: false),
      .unavailable, "Another test's result isn't this one's")
  }

  func testAFinishShowsWhereTheLearnerStartsAndItsUndoOnlyWhenItGivesBackWhatItCounts() {
    var result = PlacementTestResult(finishedAt: .now, lessonsSkipped: 4)
    result.chapter = "Why prices move"
    result.course = course
    result.nextLesson = .init(
      id: "l1", title: "News, results and expectations", estimatedMinutes: 5,
      chapter: "Why prices move")

    let end = PlacementTestEnd(
      finished: PlacementFinish(lessonsSkipped: 4, changeId: "c", result: result), attemptId: "a1")
    XCTAssertEqual(end.chapter, "Why prices move")
    XCTAssertEqual(end.course, course)
    XCTAssertEqual(end.nextLesson?.estimatedMinutes, 5)
    XCTAssertEqual(end.changeId, "c")
    XCTAssertEqual(end.undoLessons, 4)

    // An old open test finished where it stood: this finish gives back less than the title counts.
    var older = PlacementTestResult(finishedAt: .now, lessonsSkipped: 40)
    older.chapter = result.chapter
    let partial = PlacementTestEnd(
      finished: PlacementFinish(lessonsSkipped: 12, changeId: "c", result: older), attemptId: "a1")
    XCTAssertNil(partial.changeId)
    XCTAssertEqual(partial.undoLessons, 0)
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

  private let course = PlacementCourse(
    lessons: 9,
    chapters: [
      .init(lessons: 2, skipped: 2, start: false), .init(lessons: 2, skipped: 2, start: false),
      .init(lessons: 2, skipped: 0, start: true), .init(lessons: 3, skipped: 0, start: false),
    ])

  private func attempt(answered: Int = 0) -> PlacementAttempt {
    PlacementAttempt(
      answered: answered, chapter: "Variables and types", estimatedMinutes: 4, id: "a1",
      questions: 8)
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
