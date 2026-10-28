import XCTest

@testable import Zoonk

final class MistakePracticeStateTests: XCTestCase {
  func testEmptyPracticeEndsAtOnce() {
    XCTAssertEqual(MistakePracticeState(entries: []).phase, .ended(nil))
  }

  func testGapDrillOpensOnItsIdeaThenItsQuestions() {
    let gap = PracticeDrill(
      kind: .reteach, lesson: .init(id: "l", ideas: ["Idea"], title: "Lesson"),
      timeLimitSeconds: nil)
    var state = MistakePracticeState(entries: [makeEntry("m", drill: gap, questions: ["a", "b"])])

    XCTAssertEqual(state.phase, .idea)
    state.start()
    XCTAssertEqual(state.phase, .answering)

    answer(&state, grade: makeGrade(isCorrect: true))
    state.next()
    XCTAssertEqual(state.phase, .answering, "the idea opens only before the drill's first question")
  }

  func testMisreadDrillReadsEveryQuestionFirst() {
    let misread = PracticeDrill(kind: .readCarefully, lesson: nil, timeLimitSeconds: nil)
    var state = MistakePracticeState(entries: [
      makeEntry("m", drill: misread, questions: ["a", "b"])
    ])

    XCTAssertEqual(state.phase, .reading)
    state.reveal()
    answer(&state, grade: makeGrade(isCorrect: false))
    state.next()
    XCTAssertEqual(state.phase, .reading)
  }

  func testVerdictsCountNotSureAsNeutralButTimeoutsAsMisses() {
    var state = MistakePracticeState(entries: [makeEntry("m", questions: ["a", "b", "c"])])

    answer(&state, .dontKnow, grade: makeGrade(isCorrect: false))
    state.next()
    answer(&state, .dontKnow, timedOut: true, grade: makeGrade(isCorrect: false))
    state.next()

    XCTAssertEqual(state.segments, [.read, .wrong, .current])
  }

  func testFixedMistakesAreCountedOnceAndDroppedWhenReopened() {
    var state = MistakePracticeState(entries: [
      makeEntry("m1", questions: ["a"]), makeEntry("m2", questions: ["b"]),
    ])

    answer(&state, grade: makeGrade(isCorrect: true, fixed: true, fixedIds: ["m1", "m3"]))
    state.next()
    XCTAssertEqual(Set(state.fixedIds), ["m1", "m3"])

    answer(&state, grade: makeGrade(isCorrect: false, fixedIds: [], stillOpen: true))
    XCTAssertEqual(Set(state.fixedIds), ["m1", "m3"])
    XCTAssertEqual(state.answerIds.count, 2)
  }

  func testFailedAnswerKeepsItForRetryAndTheLastStepEnds() {
    var state = MistakePracticeState(entries: [makeEntry("m", questions: ["a"])])

    state.check(.choice(1), timedOut: false)
    state.answerFailed()
    XCTAssertEqual(state.phase, .answerFailed(answer: .choice(1), timedOut: false))
    XCTAssertTrue(state.acceptsAnswer)

    answer(&state, .choice(1), grade: makeGrade(isCorrect: true))
    state.next()
    XCTAssertEqual(state.phase, .ending)
  }

  func testTheOriginalQuestionMatchesWithItsContext() {
    var question = PracticeQuestion(itemId: "a", format: .multipleChoice, question: "What  is it?")
    question.context = "A case."
    let entry = MistakePracticeEntry(
      cause: nil, drill: .init(kind: .retry, lesson: nil, timeLimitSeconds: nil), mistakeId: "m",
      questions: [question], snapshotQuestion: "A case. What is it?", snapshotAnswer: nil)

    XCTAssertTrue(
      MistakePracticeStep(entry: entry, isFirstOfEntry: true, question: question).isMistakeQuestion)
  }

  private func answer(
    _ state: inout MistakePracticeState, _ answer: PracticeAnswer = .choice(0),
    timedOut: Bool = false,
    grade: MistakePracticeGrade
  ) {
    state.check(answer, timedOut: timedOut)
    state.answered(grade, mistakeId: state.step?.entry.mistakeId ?? "")
  }
}

final class CheckpointDuelTests: XCTestCase {
  func testABossIsWonAtThePassMarkAndLostWhenItCantBeReached() {
    XCTAssertEqual(
      DuelDecision.decide(answered: 3, correct: 3, kind: .boss, passMark: 3, questions: 5), .won)
    XCTAssertEqual(
      DuelDecision.decide(answered: 3, correct: 0, kind: .boss, passMark: 3, questions: 5), .lost)
    XCTAssertNil(
      DuelDecision.decide(answered: 2, correct: 0, kind: .boss, passMark: 3, questions: 5))
    XCTAssertNil(
      DuelDecision.decide(answered: 5, correct: 0, kind: .weekly, passMark: 3, questions: 5))
    XCTAssertNil(
      DuelDecision.decide(answered: 0, correct: 0, kind: .finalBoss, passMark: 0, questions: 0))
  }

  func testTheDuelResumesAtTheFirstUnansweredQuestionAndStopsOnceDecided() throws {
    var state = CheckpointDuelState(load: try makeCheckpoint(passMark: 2, answered: ["a": true]))

    XCTAssertEqual(state.currentQuestion?.itemId, "b")
    XCTAssertFalse(state.isResult)

    state.confirm()
    state.answered(
      .choice(0), isCorrect: true, itemId: "b", reinforcementLessons: nil, transcript: nil,
      setId: nil)
    XCTAssertEqual(
      state.currentQuestion?.itemId, "b", "the verdict stays on its question until Next")
    XCTAssertEqual(state.decision, .won)

    state.next()
    XCTAssertNil(state.currentQuestion)
    XCTAssertTrue(state.isDone)
  }

  func testAFailedAnswerSaysSoAndKeepsTheQuestion() throws {
    var state = CheckpointDuelState(load: try makeCheckpoint(passMark: 2, answered: [:]))

    state.confirm()
    state.failed(.answer)

    XCTAssertEqual(state.failure, .answer)
    XCTAssertFalse(state.isPending)
    XCTAssertEqual(state.currentQuestion?.itemId, "a")
  }

  func testAFinishedCheckpointOpensOnItsResult() throws {
    let state = CheckpointDuelState(
      load: try makeCheckpoint(passMark: 2, answered: [:], status: "completed"))
    XCTAssertTrue(state.isResult)
  }

  private func makeCheckpoint(passMark: Int, answered: [String: Bool], status: String = "active")
    throws
    -> CheckpointLoad
  {
    let questions = ["a", "b", "c"].map { id in
      var question = PracticeQuestion(
        itemId: id, format: .multipleChoice, question: id, options: ["x", "y"])
      question.answered = answered[id].map { PracticeAnsweredMark(blank: false, isCorrect: $0) }
      return question
    }

    let json = #"""
      {"blockId":"b","checklist":[],"kind":"boss","mock":false,"nextPhase":null,"passMark":\#(passMark),
       "phase":null,"planItemId":null,"questions":[],"reinforcementLessons":0,"rematch":false,"result":null,
       "retry":null,"reward":{"badge":true,"brainPower":50,"glasses":null,"phaseComplete":true},
       "sessionId":"s","status":"\#(status)","timeLimitMinutes":null,"title":null,"trueFalseLabels":"trueFalse"}
      """#
    let checkpoint = try JSONDecoder().decode(
      Components.Schemas.Checkpoint.self, from: Data(json.utf8))
    return CheckpointLoad(checkpoint: checkpoint, questions: questions, trueFalseLabels: .trueFalse)
  }
}

private func makeEntry(
  _ mistakeId: String,
  drill: PracticeDrill = .init(kind: .retry, lesson: nil, timeLimitSeconds: nil),
  questions: [String]
) -> MistakePracticeEntry {
  MistakePracticeEntry(
    cause: nil, drill: drill, mistakeId: mistakeId,
    questions: questions.map {
      PracticeQuestion(itemId: $0, format: .multipleChoice, question: $0, options: ["x", "y"])
    },
    snapshotQuestion: "saved", snapshotAnswer: nil)
}

private func makeGrade(
  isCorrect: Bool, fixed: Bool = false, fixedIds: [String] = [], stillOpen: Bool = false
)
  -> MistakePracticeGrade
{
  MistakePracticeGrade(
    answerId: UUID().uuidString, correctAnswer: .choice(0), explanation: nil, fixed: fixed,
    fixedMistakeIds: fixedIds, isCorrect: isCorrect, isStillOpen: stillOpen, reached: .nothing,
    trap: nil)
}

final class GradedRunTests: XCTestCase {
  func testAFullDraftReopensReadyToSubmit() {
    let saved = ["a", "b"].map {
      PracticeChoiceAnswer(answer: .choice(0), durationMs: 1, itemId: $0)
    }
    let resumed = PracticeAnswerDraft.resumable(saved, questionIds: ["a", "b"])

    XCTAssertEqual(resumed.count, 2)
    XCTAssertEqual(GradedRunStage(answered: resumed.count, asked: 2, total: 2), .readyToSubmit)
  }

  func testADraftForOtherQuestionsStartsOver() {
    let saved = [PracticeChoiceAnswer(answer: .dontKnow, durationMs: 1, itemId: "old")]
    XCTAssertEqual(PracticeAnswerDraft.resumable(saved, questionIds: ["a", "b"]), [])
  }

  func testStages() {
    XCTAssertEqual(GradedRunStage(answered: 1, asked: 2, total: 2), .asking)
    XCTAssertEqual(GradedRunStage(answered: 2, asked: 2, total: 5), .waiting)
    XCTAssertEqual(GradedRunStage(answered: 0, asked: 0, total: 0), .waiting)
  }
}

final class OptionMarkTests: XCTestCase {
  func testAWithheldAnswerMarksOnlyThePickByItsVerdict() {
    let right = PracticeItemResult(answer: .choice(1), correctAnswer: nil, isCorrect: true)
    let wrong = PracticeItemResult(answer: .choice(1), correctAnswer: nil, isCorrect: false)

    XCTAssertEqual(right.optionMark(isRightAnswer: false, isPicked: true), .right)
    XCTAssertNil(right.optionMark(isRightAnswer: false, isPicked: false))
    XCTAssertEqual(wrong.optionMark(isRightAnswer: false, isPicked: true), .wrong)
  }

  func testADisclosedAnswerMarksItAndTheWrongPick() {
    let result = PracticeItemResult(answer: .choice(1), correctAnswer: .choice(0), isCorrect: false)

    XCTAssertEqual(result.optionMark(isRightAnswer: true, isPicked: false), .right)
    XCTAssertEqual(result.optionMark(isRightAnswer: false, isPicked: true), .wrong)
    XCTAssertNil(result.optionMark(isRightAnswer: false, isPicked: false))
  }
}
