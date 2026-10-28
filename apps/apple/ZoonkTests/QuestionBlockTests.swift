import XCTest

@testable import Zoonk

final class QuestionBlockStateTests: XCTestCase {
  func testResumesAtTheFirstUnansweredQuestion() {
    let state = QuestionBlockState(questions: [
      makeQuestion("a", answered: .init(blank: false, isCorrect: true)),
      makeQuestion("b"),
      makeQuestion("c"),
    ])

    XCTAssertEqual(state.index, 1)
    XCTAssertEqual(state.phase, .answering)
    XCTAssertEqual(state.segments, [.right, .current, .ahead])
  }

  func testFullyAnsweredBlockWaitsForFinish() {
    let state = QuestionBlockState(questions: [
      makeQuestion("a", answered: .init(blank: false, isCorrect: false))
    ])

    XCTAssertEqual(state.phase, .finishReady)
    XCTAssertNil(state.question)
  }

  func testAnsweringTheLastQuestionMovesToFinishing() {
    var state = QuestionBlockState(questions: [makeQuestion("a")])

    state.check()
    state.answered(.choice(1), feedback: makeFeedback(isCorrect: true, level: 2), itemId: "a")
    XCTAssertEqual(state.hyperdrive, 2)
    XCTAssertEqual(state.segments, [.right])

    state.next()
    XCTAssertEqual(state.phase, .finishing)
  }

  func testPlacementAndBlankAnswersReadAsNeitherRightNorWrong() {
    var placement = makeQuestion("a")
    placement.placement = true
    var state = QuestionBlockState(questions: [placement, makeQuestion("b")])

    state.answered(.dontKnow, feedback: makeFeedback(isCorrect: false), itemId: "a")
    state.next()
    state.answered(.dontKnow, feedback: makeFeedback(isCorrect: false, blank: true), itemId: "b")

    XCTAssertEqual(state.segments, [.read, .read])
  }

  func testNetTallyCountsBlanksAsNeitherAndKeepsEarlierVisits() {
    var state = QuestionBlockState(questions: [
      makeQuestion("a", answered: .init(blank: true, isCorrect: false)),
      makeQuestion("b", answered: .init(blank: false, isCorrect: true)),
      makeQuestion("c"),
      makeQuestion("d"),
    ])

    state.answered(.trueFalse(true), feedback: makeFeedback(isCorrect: false), itemId: "c")

    XCTAssertEqual(state.netTally, NetTally(blank: 1, right: 1, wrong: 1))
    XCTAssertEqual(state.netTally.net, 0)
  }

  func testDrillStages() {
    let ideas = PracticeDrill(
      kind: .reteach, lesson: .init(id: "l", ideas: ["One"], title: "T"), timeLimitSeconds: nil)
    let misread = PracticeDrill(kind: .readCarefully, lesson: nil, timeLimitSeconds: nil)
    let gapWithoutIdeas = PracticeDrill(kind: .reteach, lesson: nil, timeLimitSeconds: nil)

    XCTAssertEqual(DrillStage.opening(drill: ideas, isFirstOfDrill: true), .idea)
    XCTAssertEqual(DrillStage.opening(drill: ideas, isFirstOfDrill: false), .open)
    XCTAssertEqual(DrillStage.opening(drill: misread, isFirstOfDrill: false), .reading)
    XCTAssertEqual(DrillStage.opening(drill: gapWithoutIdeas, isFirstOfDrill: true), .open)
    XCTAssertEqual(DrillStage.afterIdea(drill: misread), .reading)
  }
}

@MainActor
final class QuestionBlockRunTests: XCTestCase {
  func testAnswerThenFinishPublishesTheCompletion() async throws {
    let client = FakeQuestionBlockClient(answers: [
      .success(.answered(makeFeedback(isCorrect: true)))
    ])
    let run = QuestionBlockRun(detail: makeDetail(["a"]), client: client)

    await run.submit(.choice(0))
    guard case .feedback(let answer, _) = run.state.phase else {
      return XCTFail("expected feedback")
    }
    XCTAssertEqual(answer, .choice(0))

    await run.next()
    guard case .finished = run.state.phase else { return XCTFail("expected finished") }
    let finishes = await client.finishes
    XCTAssertEqual(finishes, 1)
  }

  func testFailedAnswerKeepsTheDraftToRetry() async {
    let client = FakeQuestionBlockClient(answers: [
      .failure(APIError.network), .success(.answered(makeFeedback(isCorrect: false))),
    ])
    let run = QuestionBlockRun(detail: makeDetail(["a"]), client: client)
    run.draft = .choice(2)

    await run.submit(.choice(2))
    XCTAssertEqual(run.state.phase, .answerFailed)

    await run.retryAnswer()
    guard case .feedback(let answer, _) = run.state.phase else {
      return XCTFail("expected feedback")
    }
    XCTAssertEqual(answer, .choice(2))
  }

  func testAnswerIsIgnoredWhileCheckingOrGraded() async {
    let client = FakeQuestionBlockClient(answers: [
      .success(.answered(makeFeedback(isCorrect: true)))
    ])
    let run = QuestionBlockRun(detail: makeDetail(["a", "b"]), client: client)

    await run.submit(.choice(0))
    await run.submit(.choice(1))

    let sent = await client.sent
    XCTAssertEqual(sent, [.choice(0)])
  }

  func testBlockNotActiveAsksTheHostToRefresh() async {
    let client = FakeQuestionBlockClient(answers: [.success(.blockNotActive)])
    let run = QuestionBlockRun(detail: makeDetail(["a"]), client: client)

    await run.submit(.choice(0))

    XCTAssertTrue(run.needsRefresh)
  }

  func testAnAnswerForALearnerWhoIsGoneShowsNothing() async {
    let client = FakeQuestionBlockClient(answers: [.failure(QuestionBlockWriteObsolete())])
    let run = QuestionBlockRun(detail: makeDetail(["a"]), client: client)

    await run.submit(.choice(0))

    XCTAssertEqual(run.state.phase, .checking, "no grade, no failure, no retry for someone else")
  }

  func testFailedFinishOffersItAgain() async {
    let client = FakeQuestionBlockClient(
      answers: [.success(.answered(makeFeedback(isCorrect: true)))], finishFails: true)
    let run = QuestionBlockRun(detail: makeDetail(["a"]), client: client)

    await run.submit(.choice(0))
    await run.next()

    XCTAssertEqual(run.state.phase, .finishFailed)
  }

  func testTimedOutDrillSendsDontKnowWithTheWholeTimeBox() async {
    var question = makeQuestion("a")
    question.drill = PracticeDrill(kind: .timed, lesson: nil, timeLimitSeconds: 30)
    question.mistakeId = "m"
    let client = FakeQuestionBlockClient(answers: [
      .success(.answered(makeFeedback(isCorrect: false)))
    ])
    let run = QuestionBlockRun(
      detail: makeDetail(questions: [question]), client: client,
      now: { Date(timeIntervalSince1970: 0) })

    await run.timeUp()

    let sent = await client.sent
    let durations = await client.durations
    XCTAssertTrue(run.timedOut)
    XCTAssertEqual(sent, [.dontKnow])
    XCTAssertEqual(durations, [30_000])
  }
}

final class PracticeModelTests: XCTestCase {
  func testAnswersEncodeInTheAPIShape() throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys

    XCTAssertEqual(
      String(decoding: try encoder.encode(PracticeAnswer.choice(2)), as: UTF8.self),
      #"{"selectedIndex":2}"#)
    XCTAssertEqual(
      String(decoding: try encoder.encode(PracticeAnswer.dontKnow), as: UTF8.self),
      #"{"dontKnow":true}"#)
    XCTAssertEqual(
      String(decoding: try encoder.encode(PracticeAnswer.order([1, 0])), as: UTF8.self),
      #"{"order":[1,0]}"#)
  }

  func testAnswersReachTheGeneratedInputs() throws {
    let input: Components.Schemas.StudyAnswerInput.AnswerPayload = try PracticeJSON.recode(
      PracticeAnswer.number(2.5))
    XCTAssertEqual(input.value3?.number, 2.5)

    let choice: Components.Schemas.ChoiceAnswer = try PracticeJSON.recode(
      PracticeAnswer.trueFalse(false))
    XCTAssertEqual(choice.value3?.isTrue, false)
  }

  func testBankQuestionDecodesWithDefaults() throws {
    let json = #"""
      {"format":"trueFalse","itemId":"i","skillId":"s","question":"Q","options":null,"context":null,
       "image":null,"visual":null,"set":null}
      """#
    let question = try JSONDecoder().decode(PracticeQuestion.self, from: Data(json.utf8))

    XCTAssertEqual(question.format, .trueFalse)
    XCTAssertEqual(question.options, [])
    XCTAssertEqual(question.select, .one)
    XCTAssertFalse(question.placement)
  }

  func testSelectAllAndCountsDecode() throws {
    XCTAssertEqual(try JSONDecoder().decode(PracticeSelect.self, from: Data(#""all""#.utf8)), .all)
    XCTAssertEqual(try JSONDecoder().decode(PracticeSelect.self, from: Data("2".utf8)), .count(2))
    XCTAssertTrue(PracticeSelect.all.isComplete([3]))
    XCTAssertFalse(PracticeSelect.count(2).isComplete([3]))
  }

  func testNumericEntryReadsCommasPointsAndFractions() {
    XCTAssertEqual(NumericEntryParser.parse("2,5", entry: nil), 2.5)
    XCTAssertEqual(NumericEntryParser.parse("1.234,5", entry: nil), 1234.5)
    XCTAssertEqual(NumericEntryParser.parse("2/4", entry: .init(kind: .fraction, places: nil)), 0.5)
    XCTAssertNil(NumericEntryParser.parse("2/0", entry: .init(kind: .fraction, places: nil)))
    XCTAssertNil(NumericEntryParser.parse("2.5", entry: .init(kind: .integer, places: nil)))
    XCTAssertNil(NumericEntryParser.parse("abc", entry: nil))
  }

  func testNumericDraftShowsAsTextThatReadsBackTheSameNumber() {
    let typed = [2.5, 1234.5, 12, 0.1, -7.25, 0.000123456789, 3.14159265358979, 1_000_000_000]

    for identifier in ["en_US", "pt_BR", "de_DE"] {
      let locale = Locale(identifier: identifier)

      for number in typed {
        let text = NumericEntryParser.text(for: .number(number), locale: locale)
        XCTAssertEqual(NumericEntryParser.parse(text, entry: nil), number, "\(identifier): \(text)")
      }
    }

    XCTAssertEqual(
      NumericEntryParser.text(for: .number(1234.5), locale: Locale(identifier: "pt_BR")), "1234,5")
    XCTAssertEqual(NumericEntryParser.text(for: nil), "")
    XCTAssertEqual(NumericEntryParser.text(for: .dontKnow), "")
  }
}

func makeQuestion(_ id: String, answered: PracticeAnsweredMark? = nil) -> PracticeQuestion {
  var question = PracticeQuestion(
    itemId: id, format: .multipleChoice, question: "Question \(id)", options: ["A", "B", "C"])
  question.answered = answered
  return question
}

func makeFeedback(isCorrect: Bool, blank: Bool = false, level: Int = 1) -> PracticeFeedback {
  PracticeFeedback(
    blank: blank, correctAnswer: .choice(0), explanation: nil,
    hyperdrive: .init(level: level, streak: 1),
    isCorrect: isCorrect, mistakeFixed: false, pauseSuggested: false, reinforcementLessons: nil,
    savedToNotebook: false, transcript: nil, trap: nil, workedSteps: [])
}

private func makeDetail(_ ids: [String]) -> QuestionBlockDetail {
  makeDetail(questions: ids.map { makeQuestion($0) })
}

private func makeDetail(questions: [PracticeQuestion]) -> QuestionBlockDetail {
  QuestionBlockDetail(
    block: PracticeBlock(
      capsules: [], checkpoint: nil, estimatedMinutes: 5, extra: false, fullReview: false,
      id: "block",
      kind: .practice, mistakesOnly: false, netScored: false, status: .active, title: nil),
    hints: true, questions: questions, trueFalseLabels: .trueFalse)
}

private actor FakeQuestionBlockClient: QuestionBlockClient {
  private var answers: [Result<StudyAnswerOutcome, Error>]
  private let finishFails: Bool
  private(set) var sent: [PracticeAnswer] = []
  private(set) var durations: [Int] = []
  private(set) var finishes = 0

  init(answers: [Result<StudyAnswerOutcome, Error>], finishFails: Bool = false) {
    self.answers = answers
    self.finishFails = finishFails
  }

  func answer(itemId: String, answer: PracticeAnswer, durationMs: Int) async throws
    -> StudyAnswerOutcome
  {
    sent.append(answer)
    durations.append(durationMs)
    return try answers.removeFirst().get()
  }

  func finish() async throws -> Components.Schemas.StudyBlockCompletion {
    finishes += 1
    if finishFails { throw APIError.network }
    return try JSONDecoder().decode(
      Components.Schemas.StudyBlockCompletion.self, from: Data(completionJSON.utf8))
  }
}

private let completionJSON = #"""
  {"blockId":"block","brainPower":10,"capsulesOpened":0,"ceremony":null,"checkpoint":null,"comesBackOn":null,
   "completedMissions":[],"correct":1,"fullMeal":{"bonus":0,"paid":false},"milestones":[],"missions":[],
   "netScore":null,"nextBlockId":null,"reached":{"energy":null,"level":null},"sessionBar":{"completed":1,"total":3},
   "sessionCompleted":false,"testOutOffer":null,"topHyperdrive":1,"total":1}
  """#
