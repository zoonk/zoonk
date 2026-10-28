import XCTest

@testable import Zoonk

final class LessonPlayerStateTests: XCTestCase {
  func testReadsAnswersAndEndsInOrder() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())

    XCTAssertEqual(state.currentStep?.id, "hook")
    state.continueLesson()
    XCTAssertEqual(state.currentStep?.id, "explanation")
    state.continueLesson()
    XCTAssertEqual(state.currentStep?.id, "check")

    try answerCheck(&state, optionId: "right")
    XCTAssertEqual(state.phase, .feedback)
    XCTAssertEqual(state.currentResult?.isCorrect, true)

    state.continueLesson()
    XCTAssertEqual(state.currentStep?.id, "summary")
    state.continueLesson()

    XCTAssertEqual(state.phase, .completed)
    XCTAssertEqual(state.completion?.status, .saving)
    XCTAssertEqual(state.firstVerdicts, ["check": true])
  }

  func testMissedCheckComesBackOnceAndKeepsItsFirstVerdict() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.continueLesson()

    try answerCheck(&state, optionId: "wrong")
    XCTAssertEqual(state.currentResult?.correctAnswer, "Paris")
    state.continueLesson()
    state.continueLesson()

    XCTAssertEqual(state.currentStep?.id, "check", "a missed check returns after the summary")
    try answerCheck(&state, optionId: "wrong")
    state.continueLesson()

    XCTAssertEqual(state.phase, .completed, "it comes back only once")
    XCTAssertEqual(state.firstVerdicts, ["check": false])
  }

  func testWorkedExampleRevealsOnePartPerContinue() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(workedExample)])

    XCTAssertEqual(state.revealed["worked"] ?? 1, 1)
    state.continueLesson()
    XCTAssertEqual(state.revealed["worked"], 2)
    state.continueLesson()
    XCTAssertEqual(state.phase, .completed)
  }

  func testBuiltLanguageAnswerGetsOneChanceToSelfCorrect() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(fillBlank)])
    let step = try XCTUnwrap(state.currentStep)

    let first = try XCTUnwrap(LessonGrading.grade(.fillBlank(userAnswers: ["est"]), step: step))
    state.resolve(step.id, result: LessonStepResult(first))
    XCTAssertEqual(state.phase, .playing)
    XCTAssertEqual(state.notice, .selfCorrect)
    XCTAssertEqual(state.firstVerdicts, [step.id: false])

    let second = try XCTUnwrap(LessonGrading.grade(.fillBlank(userAnswers: [" Suis "]), step: step))
    state.resolve(step.id, result: LessonStepResult(second))
    XCTAssertEqual(state.phase, .feedback)
    XCTAssertNil(state.notice)
    XCTAssertEqual(state.firstVerdicts, [step.id: false], "the first verdict still counts")
  }

  func testPreviousShowsAnAnsweredScreenAgain() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.continueLesson()
    try answerCheck(&state, optionId: "right")
    state.continueLesson()

    XCTAssertTrue(state.canGoBack)
    state.goBack()
    XCTAssertEqual(state.currentStep?.id, "check")
    XCTAssertEqual(state.phase, .feedback)
    XCTAssertTrue(state.reviewing)
    state.continueLesson()
    XCTAssertEqual(state.currentStep?.id, "summary")
  }

  func testResumedRunOpensAfterTheReadingBeforeTheFirstOpenScreen() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps(extraCheck: true))

    state.startRun(
      runId: "run",
      answers: [LessonRunAnswer(stepId: "check", isCorrect: false, answeredAt: .now)])

    XCTAssertEqual(state.runId, "run")
    XCTAssertEqual(state.currentStep?.id, "explanation-2", "the reading before the open question")
    XCTAssertEqual(state.queue.last, "check", "a check missed once comes back at the end")
    XCTAssertEqual(state.firstVerdicts, ["check": false])
  }

  func testRunWithEveryScreenAnsweredIsReadyToFinish() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())

    state.startRun(
      runId: "run", answers: [LessonRunAnswer(stepId: "check", isCorrect: true, answeredAt: .now)])

    XCTAssertEqual(state.phase, .completed)
    XCTAssertEqual(state.completion?.status, .ready)
  }

  func testRunStartedAfterAnAnswerKeepsTheLearnersScreen() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.continueLesson()
    try answerCheck(&state, optionId: "right")

    state.startRun(
      runId: "run", answers: [LessonRunAnswer(stepId: "check", isCorrect: false, answeredAt: .now)])

    XCTAssertEqual(state.currentStep?.id, "check")
    XCTAssertEqual(state.phase, .feedback)
  }

  func testQuestionFirstSupportOpensWithTheQuestion() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())

    state.startRun(runId: "run", answers: [], support: .questionFirst)

    XCTAssertEqual(state.queue, ["hook", "check", "explanation", "summary"])
  }

  func testOptionalScreensAreLeftOut() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())

    state.startRun(runId: "run", answers: [], optionalStepIds: ["check"])

    XCTAssertEqual(state.queue, ["hook", "explanation", "summary"])
  }

  func testIncompleteCompletionReturnsToTheMissingScreen() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.startRun(runId: "run", answers: [])
    state.continueLesson()
    state.continueLesson()
    try answerCheck(&state, optionId: "right")
    state.continueLesson()
    state.continueLesson()
    XCTAssertEqual(state.phase, .completed)

    state.resync(answers: [])

    XCTAssertEqual(state.currentStep?.id, "hook", "nothing reached the server: from the top")
    XCTAssertEqual(state.notice, .answerNotSaved)
    XCTAssertEqual(state.phase, .playing)
  }

  func testResyncWithEveryAnswerSavedMarksTheCompletionFailed() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.continueLesson()
    try answerCheck(&state, optionId: "right")
    state.continueLesson()
    state.continueLesson()

    state.resync(answers: [LessonRunAnswer(stepId: "check", isCorrect: true, answeredAt: .now)])

    XCTAssertEqual(state.phase, .completed)
    XCTAssertEqual(state.completion?.status, .failed)
  }

  func testLateConfirmationOfAnEarlierAttemptChangesNothing() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.continueLesson()
    try answerCheck(&state, optionId: "wrong", attemptId: "second")

    state.confirm("check", attemptId: "first", nextReviewAt: .now, savedMistake: true)
    XCTAssertEqual(state.currentResult?.savedMistake, false)

    state.confirm("check", attemptId: "second", nextReviewAt: .now, savedMistake: true)
    XCTAssertEqual(state.currentResult?.savedMistake, true)
  }

  func testServerGradedAnswerWaitsAndCanBeRetried() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(typedAnswer)])

    state.select(.typedAnswer(text: "Because"), for: "typed")
    state.startChecking()
    XCTAssertEqual(state.phase, .checking)
    state.failChecking()
    XCTAssertEqual(state.phase, .playing)
    XCTAssertTrue(state.checkFailed)
    XCTAssertEqual(state.currentAnswer, .typedAnswer(text: "Because"), "the answer stays to resend")
  }

  func testRefusedRunHasNoPrevious() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try lessonSteps())
    state.continueLesson()
    state.refuseRun(.limitReached(tier: .guest, period: .total))

    XCTAssertFalse(state.canGoBack)
  }

  // MARK: - Helpers

  private func answerCheck(
    _ state: inout LessonPlayerState, optionId: String, attemptId: String? = nil
  ) throws {
    let step = try XCTUnwrap(state.currentStep)
    state.select(.check(optionId: optionId), for: step.id)
    let grade = try XCTUnwrap(LessonGrading.grade(.check(optionId: optionId), step: step))
    state.resolve(step.id, result: LessonStepResult(grade, attemptId: attemptId))
  }

  private func lessonSteps(extraCheck: Bool = false) throws -> [LessonStep] {
    var steps = [try step(textHook), try step(explanation), try step(check(id: "check"))]

    if extraCheck {
      steps.append(
        try step(
          explanation.replacingOccurrences(
            of: "\"id\": \"explanation\"", with: "\"id\": \"explanation-2\"")))
      steps.append(try step(check(id: "second")))
    }

    return steps + [try step(summary)]
  }
}

final class LessonGradingTests: XCTestCase {
  func testArrangedWordsIgnorePunctuationAndCase() throws {
    let step = try step(reading)

    let right = LessonGrading.grade(.reading(arrangedWords: ["je", "suis", "Marie"]), step: step)
    let wrong = LessonGrading.grade(.reading(arrangedWords: ["Marie", "suis", "je"]), step: step)

    XCTAssertEqual(right?.isCorrect, true)
    XCTAssertEqual(right?.correctAnswer, "Je suis Marie.")
    XCTAssertEqual(wrong?.isCorrect, false)
  }

  func testFillBlankShowsTheWholeSentence() throws {
    let grade = LessonGrading.grade(.fillBlank(userAnswers: ["es"]), step: try step(fillBlank))

    XCTAssertEqual(grade?.isCorrect, false)
    XCTAssertEqual(grade?.correctAnswer, "Je suis ici.")
  }

  func testNumericActivityAnswerWithinTolerance() throws {
    let step = try step(numericActivity)

    XCTAssertEqual(LessonGrading.grade(.activity(.numeric(10.4)), step: step)?.isCorrect, true)
    XCTAssertEqual(LessonGrading.grade(.activity(.numeric(11)), step: step)?.isCorrect, false)
    XCTAssertNil(
      LessonGrading.grade(.activity(.choice(optionId: "a")), step: step),
      "an answer that doesn't fit the check isn't graded")
  }

  func testInteractionActivityIsGradedByItsRendererOrTheServer() throws {
    let step = try step(interactionActivity)
    let answer = LessonAnswer.activity(
      ActivityAnswer(value: .object(["kind": .string("order"), "ids": .array([.string("b")])])))

    XCTAssertNil(LessonGrading.grade(answer, step: step))
    XCTAssertEqual(
      LessonGrading.grade(answer, step: step, gradeActivity: { _, _ in true })?.isCorrect, true)
  }

  func testChallengePathEndsAndScoresItsDecisions() throws {
    let step = try step(challenge)

    guard case .challenge(let content) = step.content else {
      return XCTFail("Expected a challenge")
    }

    XCTAssertEqual(
      LessonGrading.grade(.challenge(choiceIds: ["good"]), step: step)?.isCorrect, true)
    XCTAssertEqual(
      LessonGrading.grade(.challenge(choiceIds: ["bad"]), step: step)?.isCorrect, false)
    XCTAssertNil(
      LessonGrading.grade(.challenge(choiceIds: []), step: step), "a path still deciding")

    guard
      case .deciding(_, _, _, let pending) = ChallengeProgress(
        content: content, picks: ["good"], shown: 1)
    else {
      return XCTFail("Expected the first decision")
    }

    XCTAssertEqual(pending, "good")
    XCTAssertEqual(
      ChallengeWalk.meters(content, decisions: ChallengeWalk(content, choiceIds: ["bad"]).decisions)
        .first?.value, 30)
  }

  func testDecodesEveryCoreScreenKind() throws {
    let kinds = try [
      textHook, explanation, workedExample, check(id: "c"), typedAnswer, summary, fillBlank,
      reading,
      numericActivity, challenge,
    ].map { try step($0).kind }

    XCTAssertEqual(
      kinds,
      [
        .hook, .explanation, .workedExample, .check, .typedAnswer, .summary, .fillBlank, .reading,
        .activity, .challenge,
      ])
  }
}

// MARK: - Fixtures

private func step(_ json: String) throws -> LessonStep {
  try JSONDecoder().decode(LessonStep.self, from: Data(json.utf8))
}

private func teaching(_ id: String, kind: String, content: String) -> String {
  """
  {"id": "\(id)", "position": 0, "skillId": null, "citation": null, "image": null,
   "imagePending": false, "kind": "\(kind)", "content": \(content)}
  """
}

private let textHook = teaching(
  "hook", kind: "hook", content: #"{"variant": "text", "text": "Why?"}"#)

private let explanation = teaching(
  "explanation", kind: "explanation", content: #"{"title": "Idea", "text": "Paris is **big**."}"#)

private let workedExample = teaching(
  "worked", kind: "workedExample",
  content:
    #"{"problem": "2 + 2", "steps": [{"text": "Add"}, {"text": "Done", "math": "4"}], "result": "4"}"#
)

private func check(id: String) -> String {
  teaching(
    id, kind: "check",
    content: #"""
      {"question": "Capital of France?", "basis": null, "options": [
        {"id": "right", "isCorrect": true, "reason": "It is.", "text": "Paris"},
        {"id": "wrong", "isCorrect": false, "reason": "That's Lyon.", "text": "Lyon"}]}
      """#)
}

private let typedAnswer = teaching(
  "typed", kind: "typedAnswer",
  content:
    #"{"question": "Why?", "basis": null, "keyPoints": ["size"], "sampleAnswer": "Because."}"#)

private let summary = teaching(
  "summary", kind: "summary", content: #"{"ideas": [{"text": "Paris"}]}"#)

private func language(_ id: String, kind: String, content: String, sentence: String = "null")
  -> String
{
  """
  {"id": "\(id)", "position": 0, "skillId": null, "kind": "\(kind)", "wordHints": null,
   "exercise": {"id": "\(id)", "position": 0, "kind": "\(kind)", "content": \(content),
     "sentence": \(sentence), "word": null, "wordBankOptions": [], "sentenceWordOptions": [],
     "fillBlankOptions": [], "translationOptions": [], "vocabularyOptions": [],
     "matchColumnsRightItems": []}}
  """
}

private let fillBlank = language(
  "blank", kind: "fillBlank",
  content:
    #"{"template": "Je [BLANK] ici.", "answers": ["suis"], "distractors": ["es"], "feedback": "Je → suis."}"#
)

private let reading = language(
  "reading", kind: "reading", content: "{}",
  sentence: #"""
    {"id": "s", "sentence": "Je suis Marie.", "translation": "I am Marie.", "explanation": null,
     "audioUrl": null, "romanization": null, "distractors": [], "translationDistractors": []}
    """#)

private let numericActivity = teaching(
  "numeric", kind: "activity",
  content: #"""
    {"template": "numberLine", "prompt": "Move it", "fields": {"start": 0},
     "check": {"kind": "numeric", "question": "Where?", "answer": 10, "explanation": "Ten.",
       "tolerance": {"kind": "relative", "value": 0.05}}}
    """#)

private let interactionActivity = teaching(
  "order", kind: "activity",
  content: #"""
    {"template": "processOrder", "prompt": "Order", "fields": {},
     "check": {"kind": "interaction", "explanation": "First a."}}
    """#)

private let challenge = teaching(
  "challenge", kind: "challenge",
  content: #"""
    {"title": "Launch", "variant": "work", "setting": "Office", "mission": "Ship", "team": [],
     "meters": [{"id": "trust", "label": "Trust", "start": 50, "goodWhen": "high"}],
     "panels": [], "skills": [], "startNodeId": "n1",
     "nodes": [{"id": "n1", "prompt": "What now?", "messages": [], "choices": [
       {"id": "good", "text": "Ask", "next": "end", "quality": "strong", "effects": [], "replies": [], "notes": []},
       {"id": "bad", "text": "Guess", "next": "end", "quality": "weak",
        "effects": [{"meter": "trust", "change": -20}], "replies": [], "notes": []}]}],
     "endings": [{"id": "end", "outcome": "Shipped."}]}
    """#)

final class LessonPlayerHelpTests: XCTestCase {
  func testHyperdriveShowsFromThreeNewRightAnswersInARow() throws {
    var state = LessonPlayerState(
      lessonId: "lesson", steps: try ["a", "b", "c", "d"].map { try step(check(id: $0)) })
    state.startRun(
      runId: "run", answers: [], hyperdrive: LessonHyperdriveStart(knownStepIds: ["c"], streak: 1))

    try answer(&state, right: true)
    XCTAssertNil(state.hyperdriveStreak(for: "a"), "two in a row isn't shown yet")
    state.continueLesson()
    try answer(&state, right: true)
    XCTAssertEqual(state.hyperdriveStreak(for: "b"), 3, "the session's streak counts: 1 + 2")
    state.continueLesson()
    try answer(&state, right: true)
    XCTAssertNil(state.hyperdriveStreak(for: "c"), "a repeat keeps the streak, never shows it")
    state.continueLesson()
    try answer(&state, right: true)
    XCTAssertEqual(state.hyperdriveStreak(for: "d"), 4)
  }

  func testIKnowThisPassingEveryCheckEndsTheLessonTestedOut() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try helpLesson())
    state.continueLesson()
    XCTAssertTrue(state.canKnowThis)

    state.knowThis()
    XCTAssertEqual(state.queue, ["check", "second"])
    XCTAssertEqual(state.quickCheckProgress?.current, 1)
    XCTAssertFalse(state.canGoBack)

    try answer(&state, right: true)
    state.continueLesson()
    try answer(&state, right: true)
    state.continueLesson()

    XCTAssertEqual(state.phase, .completed)
    XCTAssertEqual(state.completion?.testedOut, true)
  }

  func testAMissedQuickCheckGoesBackToTheLessonAndComesBackAtTheEnd() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try helpLesson())
    state.continueLesson()
    state.knowThis()
    try answer(&state, right: true)
    state.continueLesson()
    try answer(&state, right: false)
    XCTAssertEqual(state.queue.count, 2, "no retry during the quick check")
    state.continueLesson()

    XCTAssertNil(state.quickCheck)
    XCTAssertEqual(state.currentStep?.id, "explanation", "back where the learner was")
    XCTAssertEqual(state.queue, ["hook", "explanation", "explanation-2", "summary", "second"])
  }

  func testExplainFirstBringsTheExplanationsBeforeTheQuestion() throws {
    var state = LessonPlayerState(
      lessonId: "lesson",
      steps: [
        try step(check(id: "check")), try step(explanation),
        try step(
          explanation.replacingOccurrences(
            of: "\"id\": \"explanation\"", with: "\"id\": \"explanation-2\"")),
        try step(summary),
      ])

    XCTAssertTrue(state.canExplainFirst)
    state.explainFirst()

    XCTAssertEqual(state.queue, ["explanation", "explanation-2", "check", "summary"])
    XCTAssertEqual(state.helped, ["check"])
    XCTAssertFalse(state.canExplainFirst)
  }

  func testTwoMissesInARowOnAnIdeaOfferTheExplanation() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: try helpLesson())
    state.continueLesson()
    state.continueLesson()
    state.continueLesson()
    try answer(&state, right: false)
    XCTAssertNil(state.struggleOffer, "one miss isn't struggling")
    state.continueLesson()
    state.continueLesson()
    try answer(&state, right: false)

    XCTAssertEqual(state.struggleOffer?.id, "explanation-2", "the last explanation before it")
  }

  func testCantWriteNowLeavesTheWritingOutUntilWriteAgain() throws {
    var state = LessonPlayerState(
      lessonId: "lesson", steps: [try step(typedAnswer), try step(check(id: "check"))])

    state.skipWriting()
    XCTAssertEqual(state.currentStep?.id, "check")
    XCTAssertEqual(state.notice, .writingSkipped)
    XCTAssertEqual(state.skippedWritingStepIds, ["typed"])

    state.restoreWriting()
    XCTAssertEqual(state.currentStep?.id, "typed")
    XCTAssertEqual(state.skippedWritingStepIds, [])
    XCTAssertNil(state.notice)
  }

  func testCantWriteNowAsALessonOfOnlyWritingOpensWaitsForFinish() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(typedAnswer)])

    state.skipWriting(opening: true)

    XCTAssertEqual(state.phase, .completed)
    XCTAssertEqual(state.completion?.status, .ready, "only a learner's Finish saves it")
  }

  func testIDontKnowYetShowsTheGoodAnswerWithoutAVerdict() throws {
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(typedAnswer)])

    state.dontKnow("typed")

    XCTAssertEqual(state.phase, .feedback)
    XCTAssertEqual(state.currentResult?.isSampleAnswer, true)
    XCTAssertEqual(state.currentResult?.correctAnswer, "Because.")
    XCTAssertEqual(state.firstVerdicts, [:])
    XCTAssertEqual(state.skippedWritingStepIds, ["typed"])
  }

  func testANumberQuestionIsNeverLeftOutAsWriting() throws {
    let numeric = typedAnswer.replacingOccurrences(
      of: "\"keyPoints\"", with: "\"acceptedAnswers\": [\"R$ 18\", \"18\"], \"keyPoints\"")

    XCTAssertFalse(try step(numeric).isWriting)
    XCTAssertTrue(try step(typedAnswer).isWriting)
  }

  func testLatePicturesReachTheScreensStillWaiting() throws {
    let pending = check(id: "check").replacingOccurrences(
      of: "\"imagePending\": false", with: "\"imagePending\": true")
    let drawn = check(id: "check").replacingOccurrences(
      of: "\"image\": null",
      with:
        #""image": {"id": "img", "url": "https://example.com/a.png", "alt": "A", "width": 4, "height": 3}"#
    )
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(pending)])

    XCTAssertTrue(try XCTUnwrap(state.steps["check"]).isWaitingForPicture(openedAt: .now))
    state.applyPictures(from: [try step(drawn)])

    XCTAssertEqual(state.steps["check"]?.image?.url, "https://example.com/a.png")
    XCTAssertEqual(state.steps["check"]?.imagePending, false)
  }

  // MARK: - Helpers

  private func answer(_ state: inout LessonPlayerState, right: Bool) throws {
    let step = try XCTUnwrap(state.currentStep)
    let optionId = right ? "right" : "wrong"
    state.select(.check(optionId: optionId), for: step.id)
    let grade = try XCTUnwrap(LessonGrading.grade(.check(optionId: optionId), step: step))
    state.resolve(step.id, result: LessonStepResult(grade))
  }

  /// hook, explanation, check, explanation-2, second, summary
  private func helpLesson() throws -> [LessonStep] {
    [
      try step(textHook), try step(explanation), try step(check(id: "check")),
      try step(
        explanation.replacingOccurrences(
          of: "\"id\": \"explanation\"", with: "\"id\": \"explanation-2\"")),
      try step(check(id: "second")), try step(summary),
    ]
  }
}

final class LessonMathTests: XCTestCase {
  func testExponentsRiseAndIndicesDropAsText() {
    let typeset = LessonMath.attributed("x^{2} + a_1")
    let runs = typeset.runs.map {
      (
        String(typeset[$0.range].characters),
        $0[AttributeScopes.SwiftUIAttributes.BaselineOffsetAttribute.self] ?? 0
      )
    }

    XCTAssertEqual(String(typeset.characters), "x2+a1")
    XCTAssertGreaterThan(runs.first { $0.0 == "2" }?.1 ?? 0, 0)
    XCTAssertLessThan(runs.first { $0.0 == "1" }?.1 ?? 0, 0)
  }

  func testFractionsSymbolsAndUprightText() {
    XCTAssertEqual(String(LessonMath.attributed(#"\frac{1}{2}"#).characters), "1\u{2044}2")
    XCTAssertEqual(
      String(LessonMath.attributed(#"\text{R\$}\ 50 \div 10 = \text{R\$}\ 5"#).characters),
      "R$ 50÷10=R$ 5")
    XCTAssertEqual(String(LessonMath.attributed(#"\sqrt{x+1} \leq \pi"#).characters), "√(x+1)≤π")
  }

  func testRichTextKeepsPricesAndTypesetsFormulas() {
    XCTAssertEqual(
      String(LessonRichText.attributed("It costs $5 and $10.").characters), "It costs $5 and $10.")
    XCTAssertEqual(
      String(LessonRichText.attributed(#"So $0.75 \times 80 = 60$ **now**"#).characters),
      "So 0.75×80=60 now")
  }
}

final class LessonPlayerSavingTests: XCTestCase {
  func testAMatchColumnsAnswerThatEndsTheLessonStaysUnsavedUntilTheServerTakesIt() throws {
    let match = #"""
      {"id": "match", "position": 0, "skillId": null, "kind": "matchColumns", "wordHints": null,
       "exercise": {"id": "match", "position": 0, "kind": "matchColumns",
         "content": {"pairs": [{"left": "a", "right": "b"}]}, "sentence": null, "word": null,
         "wordBankOptions": [], "sentenceWordOptions": [], "fillBlankOptions": [],
         "translationOptions": [], "vocabularyOptions": [], "matchColumnsRightItems": ["b"]}}
      """#
    var state = LessonPlayerState(lessonId: "lesson", steps: [try step(match)])
    let answer = LessonAnswer.matchColumns(userPairs: [.init(left: "a", right: "b")], mistakes: 0)
    let grade = try XCTUnwrap(LessonGrading.grade(answer, step: try XCTUnwrap(state.currentStep)))
    let unsaved = LessonPlayerState.UnsavedAnswer(
      answer: answer, attemptId: "first", durationMs: 1, usedHelp: false)

    state.resolve("match", result: LessonStepResult(grade, attemptId: "first"), saving: unsaved)

    XCTAssertEqual(state.completion?.status, .saving, "match columns finishes on its own check")
    XCTAssertEqual(state.unsavedAnswers["match"], unsaved, "so finishing has to wait for it")

    state.answerSaved("match", attemptId: "older")
    XCTAssertNotNil(state.unsavedAnswers["match"], "a reply about another attempt changes nothing")

    state.confirm("match", attemptId: "first", nextReviewAt: nil, savedMistake: false)
    XCTAssertTrue(state.unsavedAnswers.isEmpty)
  }

  func testANumberedPictureThatNeverCameLeavesItsQuestionOut() throws {
    let numbered = check(id: "numbered")
      .replacingOccurrences(of: "\"imagePending\": false", with: "\"imagePending\": true")
      .replacingOccurrences(
        of: "\"basis\": null,",
        with:
          #""basis": null, "image": {"alt": "A flower", "prompt": "Flower", "parts": ["ovary"]},"#)
    let openedAt = Date.now.addingTimeInterval(-10 * 60)
    var state = LessonPlayerState(
      lessonId: "lesson", steps: [try step(textHook), try step(numbered), try step(summary)])
    let question = try XCTUnwrap(state.steps["numbered"])

    XCTAssertTrue(state.isWaitingForPicture(question, openedAt: .now), "the check waits for it")
    XCTAssertFalse(state.isWaitingForPicture(question, openedAt: openedAt), "until its wait ends")

    state.leaveOutLostPictures(openedAt: openedAt)
    XCTAssertEqual(state.queue, ["hook", "summary"])
  }
}
