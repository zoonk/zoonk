import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class TutorConversationTests: XCTestCase {
  func testSendingStreamsTheAnswerInPlace() async {
    let api = TutorAPIStub(answers: [[.text("An orbit "), .text("is a path."), .finish]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "What is an orbit?"
    await conversation.send()

    XCTAssertEqual(conversation.turns.map(\.question), ["What is an orbit?"])
    XCTAssertEqual(conversation.turns.first?.answer, "An orbit is a path.")
    XCTAssertEqual(conversation.turns.first?.status, .completed)
    XCTAssertEqual(conversation.draft, "")
    XCTAssertNil(conversation.answeringID)
    XCTAssertTrue(conversation.canAsk)
  }

  func testSavedAnswerReplacesTheStreamedTextAndEnablesLinks() async {
    let api = TutorAPIStub(answers: [
      [.text("See [Plan](https://evil.example)"), .savedAnswer("See your plan."), .finish]
    ])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "Where is my plan?"
    await conversation.send()

    XCTAssertEqual(conversation.turns.first?.answer, "See your plan.")
    XCTAssertEqual(conversation.turns.first?.linksVerified, true)
  }

  func testRefusedAnswerTakesTheComposersPlace() async {
    let limit = TutorFailure.limitReached(period: .day, tier: .free)
    let api = TutorAPIStub(answers: [], answerFailure: limit)
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "One more?"
    await conversation.send()

    XCTAssertEqual(conversation.turns.first?.status, .failed)
    XCTAssertEqual(conversation.limit, limit)
    XCTAssertFalse(conversation.canAsk)
  }

  func testStreamCutBeforeAnyTextFailsTheAnswer() async {
    let api = TutorAPIStub(answers: [[]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "Hello?"
    await conversation.send()

    XCTAssertEqual(conversation.turns.first?.status, .failed)
    XCTAssertEqual(conversation.answerFailures[conversation.turns[0].id], .failed)
    XCTAssertFalse(conversation.canAsk)
  }

  func testRetryingAFailedAnswerStreamsItAgain() async {
    let api = TutorAPIStub(answers: [[], [.text("Here it is."), .finish]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "Hello?"
    await conversation.send()
    await conversation.retryAnswer(conversation.turns[0].id)

    XCTAssertEqual(conversation.turns.first?.answer, "Here it is.")
    XCTAssertEqual(conversation.turns.first?.status, .completed)
    XCTAssertTrue(conversation.answerFailures.isEmpty)
  }

  func testQuestionWhoseReplyNeverCameIsSentAgainWithItsRequestID() async {
    let api = TutorAPIStub(askFailures: [APIError.network], answers: [[.text("Yes."), .finish]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "Is it saved?"
    await conversation.send()

    XCTAssertEqual(conversation.askFailure, .failed)
    XCTAssertEqual(conversation.draft, "Is it saved?")

    await conversation.send()

    XCTAssertEqual(api.requestIDs.count, 2)
    XCTAssertEqual(api.requestIDs[0], api.requestIDs[1])
    XCTAssertEqual(conversation.turns.first?.answer, "Yes.")
  }

  func testReplacedProposalsSayTheyWereReplaced() async {
    let earlier = TutorTurn.fixture(id: "earlier", planChange: .fixture(id: "change-1"))
    let api = TutorAPIStub(
      thread: TutorThreadPage(turns: [earlier], hasMore: false, nextCursor: nil),
      answers: [[.text("Done."), .planChangesReplaced(["change-1"]), .finish]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "Make it lighter"
    await conversation.send()

    XCTAssertEqual(conversation.turns.first?.planChange?.status, .replaced)
  }

  func testAnswerForASessionThatEndedIsDropped() async {
    let session = SessionStore.preview(account: .tutorTestAccount)
    let api = TutorAPIStub(answers: [[.text("Secret."), .finish]])
    api.beforeAnswer = {
      if let current = session.authenticatedSession {
        await session.expire(current)
      }
    }
    let conversation = TutorStore(api: api, cache: AppCache(session: session))
      .conversation(.plan(goalId: "goal"))
    await conversation.thread.load()

    conversation.draft = "Hi"
    await conversation.send()

    XCTAssertNil(conversation.thread.value)
    XCTAssertNil(conversation.answeringID)
  }

  func testAppliedPlanChangeShowsInItsTurn() async {
    let turn = TutorTurn.fixture(id: "turn", planChange: .fixture(id: "change"))
    let api = TutorAPIStub(thread: TutorThreadPage(turns: [turn], hasMore: false, nextCursor: nil))
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    let result = await conversation.decide(.fixture(id: "change"), in: "turn", decision: .applied)

    guard case .done = result else {
      return XCTFail("Expected the decision to be saved, got \(result)")
    }
    XCTAssertEqual(conversation.turns.first?.planChange?.status, .applied)
  }

  func testExpiredSessionOnAPlanChangeSignsOutInsteadOfFailing() async {
    let session = SessionStore.preview(account: .tutorTestAccount)
    let turn = TutorTurn.fixture(id: "turn", planChange: .fixture(id: "change"))
    let api = TutorAPIStub(thread: TutorThreadPage(turns: [turn], hasMore: false, nextCursor: nil))
    api.decideFailure = APIError.unauthorized
    let conversation = TutorStore(api: api, cache: AppCache(session: session))
      .conversation(.plan(goalId: "goal"))
    await conversation.thread.load()

    let result = await conversation.decide(.fixture(id: "change"), in: "turn", decision: .applied)

    guard case .obsolete = result else {
      return XCTFail("Expected an obsolete result, got \(result)")
    }
    XCTAssertNil(session.authenticatedSession)
  }

  func testFailedPlanChangeKeepsTheProposal() async {
    let turn = TutorTurn.fixture(id: "turn", planChange: .fixture(id: "change"))
    let api = TutorAPIStub(thread: TutorThreadPage(turns: [turn], hasMore: false, nextCursor: nil))
    api.decideFailure = APIError.network
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    let result = await conversation.decide(.fixture(id: "change"), in: "turn", decision: .applied)

    guard case .failed(.network) = result else {
      return XCTFail("Expected a network failure, got \(result)")
    }
    XCTAssertEqual(conversation.turns.first?.planChange?.status, .proposed)
  }

  func testKeyboardReturnSendsAndShiftReturnStartsANewLine() {
    XCTAssertTrue(TutorComposerKeys.returnSends(modifiers: []))
    XCTAssertTrue(TutorComposerKeys.returnSends(modifiers: .command))
    XCTAssertFalse(TutorComposerKeys.returnSends(modifiers: .shift))
    XCTAssertFalse(TutorComposerKeys.returnSends(modifiers: [.shift, .command]))
  }

  func testOnlyADraftWithWordsCanBeSentWhileAQuestionCanBeAsked() async {
    let api = TutorAPIStub(answers: [[]])
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    conversation.draft = "  \n "
    XCTAssertFalse(conversation.canSendDraft)

    conversation.draft = "Why?"
    XCTAssertTrue(conversation.canSendDraft)

    await conversation.send()
    conversation.draft = "And then?"
    XCTAssertFalse(conversation.canSendDraft)
  }

  func testLoadingEarlierMessagesPutsThemFirst() async {
    let latest = TutorTurn.fixture(id: "latest")
    let earlier = TutorTurn.fixture(id: "earlier")
    let api = TutorAPIStub(
      thread: TutorThreadPage(turns: [latest], hasMore: true, nextCursor: "cursor"),
      earlier: TutorThreadPage(turns: [earlier], hasMore: false, nextCursor: nil))
    let conversation = makeConversation(api: api)
    await conversation.thread.load()

    await conversation.loadEarlier()

    XCTAssertEqual(conversation.turns.map(\.id), ["earlier", "latest"])
    XCTAssertEqual(conversation.thread.value?.hasMore, false)
  }

  func testStoreKeepsOneConversationPerScope() {
    let store = TutorStore(
      api: TutorAPIStub(), cache: AppCache(session: .preview(account: .tutorTestAccount)))

    let unchecked = store.conversation(
      .item(itemId: "q", blockId: nil, answered: false, missed: false))
    let checked = store.conversation(.item(itemId: "q", blockId: nil, answered: true, missed: true))

    XCTAssertTrue(unchecked === checked)
    XCTAssertFalse(store.conversation(.chapter(chapterId: "c")) === checked)
  }

  func testALessonAsksAboutTheScreenInViewAndItsCheckedAnswer() {
    let screen = TutorScope(
      LessonTutorScope(
        lessonId: "l", stepId: "s2", stepNumber: 2, stepIds: ["s1", "s2"], suggestions: []))
    let answer = TutorScope(
      LessonTutorScope(
        lessonId: "l", stepId: "s2", stepNumber: 2, answer: .check(optionId: "a"),
        stepIds: ["s1", "s2"], suggestions: []))
    let lesson = TutorScope(
      LessonTutorScope(lessonId: "l", stepId: nil, stepIds: ["s1", "s2"], suggestions: []))

    XCTAssertEqual(
      screen,
      .step(lessonId: "l", stepId: "s2", stepNumber: 2, answer: nil, suggestions: []))
    XCTAssertFalse(screen.isAboutCheckedAnswer)
    XCTAssertTrue(answer.isAboutCheckedAnswer)
    XCTAssertEqual(screen.conversationKey, answer.conversationKey, "one conversation per screen")
    XCTAssertEqual(lesson, .lesson(lessonId: "l", stepIds: ["s1", "s2"], suggestions: []))
  }

  func testQuestionsAboutACheckedAnswerShowWhileItsInView() async {
    let thread = TutorThreadPage(
      turns: [
        .fixture(id: "screen", about: .step), .fixture(id: "answered", about: .answer),
        .fixture(id: "asking", status: .running, about: .answer),
      ],
      hasMore: false, nextCursor: nil)
    let store = TutorStore(
      api: TutorAPIStub(thread: thread),
      cache: AppCache(session: .preview(account: .tutorTestAccount)))
    let screen = TutorScope.step(
      lessonId: "l", stepId: "s", stepNumber: 1, answer: nil, suggestions: [])
    let conversation = store.conversation(screen)
    await conversation.thread.load()

    XCTAssertEqual(conversation.turns.map(\.id), ["screen", "asking"])

    _ = store.conversation(
      .step(
        lessonId: "l", stepId: "s", stepNumber: 1, answer: .check(optionId: "a"), suggestions: []))

    XCTAssertEqual(conversation.turns.map(\.id), ["screen", "answered", "asking"])
  }

  func testChunksDecodeToAnswerEvents() throws {
    func event(_ json: String) throws -> TutorAnswerEvent? {
      try JSONDecoder().decode(TutorAnswerChunk.self, from: Data(json.utf8)).event()
    }

    XCTAssertEqual(try event(#"{"type":"text-delta","id":"answer","delta":"Hi"}"#), .text("Hi"))
    XCTAssertEqual(try event(#"{"type":"finish"}"#), .finish)
    XCTAssertEqual(
      try event(#"{"type":"data-saved-answer","data":{"answer":"Saved."}}"#), .savedAnswer("Saved.")
    )
    XCTAssertEqual(
      try event(#"{"type":"data-plan-changes-replaced","data":{"ids":["a"]}}"#),
      .planChangesReplaced(["a"]))
    XCTAssertEqual(
      try event(
        #"{"type":"data-memory","data":[{"action":"added","fact":{"id":"f","statement":"Likes maps"},"previous":null}]}"#
      ),
      .memory([
        TutorMemoryChange(
          action: .added, fact: .init(id: "f", statement: "Likes maps"), previous: nil)
      ]))
    XCTAssertNil(try event(#"{"type":"text-start","id":"answer"}"#))
    XCTAssertNil(try event(#"{"type":"data-memory","data":{"unexpected":true}}"#))
    XCTAssertThrowsError(try event(#"{"type":"error","errorText":"boom"}"#))
  }

  private func makeConversation(api: TutorAPIStub) -> TutorConversation {
    TutorStore(api: api, cache: AppCache(session: .preview(account: .tutorTestAccount)))
      .conversation(.plan(goalId: "goal"))
  }
}

private final class TutorAPIStub: TutorAPIClient, @unchecked Sendable {
  var thread: TutorThreadPage
  var earlier: TutorThreadPage
  var askFailures: [Error]
  var answers: [[TutorAnswerEvent]]
  var answerFailure: TutorFailure?
  var decideFailure: Error?
  var beforeAnswer: (@MainActor () async -> Void)?
  private(set) var requestIDs: [String] = []
  private var asked = 0

  init(
    thread: TutorThreadPage = .empty, earlier: TutorThreadPage = .empty, askFailures: [Error] = [],
    answers: [[TutorAnswerEvent]] = [], answerFailure: TutorFailure? = nil
  ) {
    self.thread = thread
    self.earlier = earlier
    self.askFailures = askFailures
    self.answers = answers
    self.answerFailure = answerFailure
  }

  func thread(_ scope: TutorScope, cursor: String?, token: String) async throws -> TutorThreadPage {
    cursor == nil ? thread : earlier
  }

  func ask(
    _ scope: TutorScope, question: String, suggestion: String?, requestId: String, token: String
  ) async throws -> TutorAskedQuestion {
    requestIDs.append(requestId)

    if !askFailures.isEmpty {
      throw askFailures.removeFirst()
    }

    asked += 1
    return TutorAskedQuestion(
      turn: .fixture(id: "question-\(asked)", question: question, status: .pending),
      missionMoment: nil)
  }

  func answer(questionId: String, token: String) -> AsyncThrowingStream<TutorAnswerEvent, Error> {
    let events = answers.isEmpty ? [] : answers.removeFirst()
    let failure = answerFailure
    let beforeAnswer = beforeAnswer

    return AsyncThrowingStream { continuation in
      Task { @MainActor in
        await beforeAnswer?()

        for event in events {
          continuation.yield(event)
        }

        continuation.finish(throwing: failure)
      }
    }
  }

  func question(id: String, token: String) async throws -> TutorTurn {
    .fixture(id: id)
  }

  func decidePlanChange(
    goalId: String, changeId: String, decision: TutorPlanChangeDecision, token: String
  ) async throws -> Components.Schemas.PlanChange {
    if let decideFailure {
      throw decideFailure
    }

    var change = Components.Schemas.PlanChange.fixture(id: changeId)
    change.status = .applied
    return change
  }

  func undoMemoryChanges(_ changes: [TutorMemoryChange], token: String) async throws {}
}

extension TutorTurn {
  fileprivate static func fixture(
    id: String, question: String = "Question", status: Status = .completed, about: About = .plan,
    planChange: Components.Schemas.PlanChange? = nil
  ) -> TutorTurn {
    TutorTurn(
      id: id, question: question, answer: status == .completed ? "Answer" : nil, status: status,
      createdAt: .now, about: about, planChange: planChange, toolOffer: nil)
  }
}

extension Components.Schemas.PlanChange {
  fileprivate static func fixture(id: String) -> Self {
    .init(
      behind: nil, canApply: true, canUndo: false, createdAt: .now, days: nil, effect: nil,
      examDocument: .notice, id: id, kind: "edited", lessonsSkipped: 0, officialDate: nil,
      operations: [], reason: "A lighter week", seen: false, source: "tutor", status: .proposed,
      todaySession: nil)
  }
}

extension CurrentAccount {
  fileprivate static let tutorTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "tutor-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
