import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

final class MockSectionMovesTests: XCTestCase {
  private let forwardOnly = MockSection.Navigation(
    answerChanges: 2, forwardOnly: true, itemSeconds: 90, mustAnswer: false)

  func testAFreeSectionOpensAnyQuestion() {
    let moves = MockSectionMoves(
      answered: false, changed: [], changesAllowed: nil, navigation: nil, position: 0, reached: 0,
      total: 5)

    XCTAssertTrue(moves.canOpen(4))
    XCTAssertTrue(moves.canOpen(0))
    XCTAssertFalse(moves.canOpen(5), "No question past the section")
    XCTAssertTrue(moves.canChange(2))
    XCTAssertNil(moves.itemSeconds)
  }

  func testAForwardOnlySectionOpensOnlyTheNextQuestionAndKeepsEarlierAnswers() {
    let moves = MockSectionMoves(
      answered: true, changed: [], changesAllowed: 2, navigation: forwardOnly, position: 2,
      reached: 2, total: 5)

    XCTAssertTrue(moves.canOpen(3))
    XCTAssertFalse(moves.canOpen(1), "An earlier question stays behind")
    XCTAssertFalse(moves.canOpen(4), "Only the next one")
    XCTAssertFalse(moves.canChange(1))
    XCTAssertFalse(moves.reviewing)
    XCTAssertEqual(moves.itemSeconds, 90)
  }

  func testItsReviewOpensEveryQuestionAndCountsTheChangesLeft() {
    let moves = MockSectionMoves(
      answered: true, changed: [1], changesAllowed: 2, navigation: forwardOnly, position: 4,
      reached: 4, total: 5)

    XCTAssertTrue(moves.reviewing)
    XCTAssertTrue(moves.canOpen(0))
    XCTAssertEqual(moves.changesLeft, 1, "One of the two changes is used")
    XCTAssertTrue(moves.canChange(1), "A changed answer changes again for free")
    XCTAssertTrue(moves.canChange(0))
    XCTAssertNil(moves.itemSeconds, "The review has no question clock")
  }

  func testTheReviewRefusesChangesOnceTheyAreUsed() {
    let moves = MockSectionMoves(
      answered: true, changed: [0, 1], changesAllowed: 2, navigation: forwardOnly, position: 4,
      reached: 4, total: 5)

    XCTAssertEqual(moves.changesLeft, 0)
    XCTAssertFalse(moves.canChange(2))
    XCTAssertTrue(moves.canChange(1))
  }

  func testMustAnswerWaitsForAnAnswerButATimeOutMovesOn() {
    let navigation = MockSection.Navigation(
      answerChanges: nil, forwardOnly: true, itemSeconds: 60, mustAnswer: true)
    let moves = MockSectionMoves(
      answered: false, changed: [], changesAllowed: nil, navigation: navigation, position: 0,
      reached: 0, total: 3)

    XCTAssertFalse(moves.canAdvance)
    XCTAssertFalse(moves.canOpen(1))
    XCTAssertTrue(moves.canOpenAfterTimeout(1))
    XCTAssertFalse(moves.canOpenAfterTimeout(2))
  }

  func testAnAnswerIsRecheckedOnlyWhereItCanStillChange() {
    func canRecheck(_ navigation: MockSection.Navigation?) -> Bool {
      MockSectionMoves(
        answered: true, changed: [], changesAllowed: nil, navigation: navigation, position: 0,
        reached: 0, total: 3
      ).canRecheck
    }

    XCTAssertTrue(canRecheck(nil))
    XCTAssertTrue(canRecheck(forwardOnly), "Its review changes answers")
    XCTAssertFalse(
      canRecheck(
        MockSection.Navigation(
          answerChanges: nil, forwardOnly: true, itemSeconds: nil, mustAnswer: false)))
    XCTAssertFalse(
      canRecheck(
        MockSection.Navigation(
          answerChanges: 0, forwardOnly: true, itemSeconds: nil, mustAnswer: false)))
  }
}

@MainActor
final class MockDraftQueueTests: XCTestCase {
  private func draft(_ itemId: String, _ answer: PracticeAnswer?) -> MockDraft {
    MockDraft(answer: answer, durationMs: 0, unsure: false, itemId: itemId)
  }

  func testAnswersGoOutInOrderAndANewerOneReplacesOneStillWaiting() async {
    let sent = Recorder()
    let gate = Gate()
    let queue = MockDraftQueue { draft in
      await gate.wait()
      sent.items.append(draft)
      return .stored
    }

    queue.add(draft("a", .choice(0)))
    queue.add(draft("b", .choice(1)))
    queue.add(draft("b", .choice(2)))
    gate.open()
    await queue.idle()

    XCTAssertEqual(sent.items.map(\.itemId), ["a", "b"])
    XCTAssertEqual(sent.items.last?.answer, .choice(2), "The newest answer to b went out")
    XCTAssertEqual(queue.status, .saved)
  }

  func testAnAnswerThatDidNotGetThroughGoesAgainBeforeTheNextOne() async {
    let sent = Recorder()
    var failures = 1
    let queue = MockDraftQueue(
      retryDelay: { _ in .milliseconds(10) },
      save: { draft in
        if failures > 0 {
          failures -= 1
          return .unreachable
        }

        sent.items.append(draft)
        return .stored
      })

    queue.add(draft("a", .choice(0)))
    queue.add(draft("b", .choice(1)))
    await queue.idle()

    XCTAssertEqual(sent.items.map(\.itemId), ["a", "b"])
    XCTAssertEqual(queue.status, .saved)
  }

  /// Its "not saved yet" note stays up while each retry is on its way, so it isn't drawn and read
  /// out again on every attempt, but only an answer waiting to go again can be sent now.
  func testAnAnswerBeingSentAgainStaysUnsavedUntilItGetsThrough() async {
    var statuses: [MockDraftQueue.Status] = []
    var waits: [MockDraftQueue.Status] = []
    var failures = 3
    var queue: MockDraftQueue?
    queue = MockDraftQueue(
      retryDelay: { _ in
        Task { @MainActor in waits.append(queue?.status ?? .saved) }
        return .milliseconds(10)
      },
      save: { _ in
        statuses.append(queue?.status ?? .saved)
        if failures > 0 {
          failures -= 1
          return .unreachable
        }

        return .stored
      })

    queue?.add(draft("a", .choice(0)))
    await queue?.idle()

    XCTAssertEqual(statuses, [.saving, .resending, .resending, .resending])
    XCTAssertEqual(waits, [.retrying, .retrying, .retrying])
    XCTAssertEqual(queue?.status, .saved)
  }

  func testAFailedSaveHidesOnlyAnUnsavedAnswerFromProgress() async {
    let newAnswer = draft("new", .choice(1))
    let storedAnswer = draft("stored", .choice(2))
    let queue = MockDraftQueue { _ in .refused }

    queue.add(newAnswer)
    XCTAssertTrue(queue.countsTowardsProgress(newAnswer, initiallyStored: nil))
    await queue.idle()
    XCTAssertFalse(queue.countsTowardsProgress(newAnswer, initiallyStored: nil))

    var marked = storedAnswer
    marked.unsure = true
    queue.add(marked)
    await queue.idle()
    XCTAssertTrue(queue.countsTowardsProgress(marked, initiallyStored: storedAnswer))
  }

  func testARefusedAnswerSaysSoUntilItsQuestionsAnswerIsStored() async {
    var refuse = true
    let queue = MockDraftQueue { _ in refuse ? .refused : .stored }

    queue.add(draft("a", .choice(0)))
    await queue.idle()
    XCTAssertEqual(queue.status, .refused)

    refuse = false
    queue.add(draft("a", .choice(1)))
    await queue.idle()
    XCTAssertEqual(queue.status, .saved)
  }

  /// Another device moved a forward-only section on, so the first question's change is refused
  /// while the next one is stored: the first still isn't saved.
  func testAnotherAnswerStoredAfterARefusalDoesntSayEveryAnswerIsSaved() async {
    let queue = MockDraftQueue { draft in draft.itemId == "a" ? .refused : .stored }

    queue.add(draft("a", .choice(0)))
    queue.add(draft("b", .choice(1)))
    await queue.idle()

    XCTAssertEqual(queue.status, .refused)
  }

  /// Another question's ordinary save doesn't hide that an earlier answer still isn't saved.
  func testARefusalStaysTheStatusWhileAnotherAnswerSaves() async {
    var statuses: [MockDraftQueue.Status] = []
    var queue: MockDraftQueue?
    queue = MockDraftQueue { draft in
      guard draft.itemId == "b" else { return .refused }
      statuses.append(queue?.status ?? .saved)
      return .stored
    }

    queue?.add(draft("a", .choice(0)))
    await queue?.idle()
    queue?.add(draft("b", .choice(1)))
    await queue?.idle()

    XCTAssertEqual(statuses, [.refused])
    XCTAssertEqual(queue?.status, .refused)
  }

  /// A section handed in can't take its answers again, so its refusals go with it.
  func testHandingASectionInForgetsItsRefusals() async {
    let queue = MockDraftQueue { _ in .refused }

    queue.add(draft("a", .choice(0)))
    await queue.idle()
    queue.forgetRefusals()

    XCTAssertEqual(queue.status, .saved)
  }

  /// "Try again" sends an answer that didn't get through, and it stays unanswered until the server
  /// keeps it.
  func testAnAnswerSentAgainCountsOnlyOnceItIsStored() async {
    let gate = Gate()
    var saves = 0
    let queue = MockDraftQueue(
      retryDelay: { _ in .seconds(60) },
      save: { _ in
        saves += 1
        if saves == 1 { return .unreachable }
        await gate.wait()
        return .stored
      })
    let answer = draft("a", .choice(0))

    queue.add(answer)
    _ = try? await waitForTestCondition("The first save never failed") { queue.status == .retrying }
    XCTAssertFalse(queue.countsTowardsProgress(answer, initiallyStored: nil))

    queue.retryNow()
    _ = try? await waitForTestCondition("The answer never went again") { saves == 2 }
    XCTAssertFalse(
      queue.countsTowardsProgress(answer, initiallyStored: nil), "It counts while on its way")

    gate.open()
    await queue.idle()
    XCTAssertTrue(queue.countsTowardsProgress(answer, initiallyStored: nil))
  }

  func testStoppingDropsAnAnswerStillOnItsWayInsteadOfSendingItAgain() async {
    let gate = Gate()
    var saves = 0
    let queue = MockDraftQueue(
      retryDelay: { _ in .milliseconds(10) },
      save: { _ in
        saves += 1
        await gate.wait()
        return .unreachable
      })

    queue.add(draft("a", .choice(0)))
    _ = try? await waitForTestCondition("Fixture state did not arrive") { !(saves == 0) }
    queue.stop()
    gate.open()
    await queue.idle()

    XCTAssertEqual(saves, 1)
    XCTAssertEqual(queue.status, .saved)
  }

  func testABlankDraftIsNotAnswered() {
    XCTAssertFalse(draft("a", nil).isAnswered)
    XCTAssertFalse(draft("a", .text("  \n")).isAnswered)
    XCTAssertFalse(draft("a", .dontKnow).isAnswered, "Leave blank is a blank")
    XCTAssertTrue(draft("a", .number(0)).isAnswered)
    XCTAssertTrue(draft("a", .choice(0)).isAnswered)
  }
}

/// The one line over a mock step's buttons, as the web's.
@MainActor
final class MockBarNoteTests: XCTestCase {
  func testTryAgainWaitsWhileTheAnswerIsOnItsWayAgain() throws {
    let waiting = try XCTUnwrap(note(save: .retrying))
    let sending = try XCTUnwrap(note(save: .resending))

    XCTAssertEqual(waiting.politeLine, sending.politeLine, "The note stays as it was")
    XCTAssertEqual(sending.tone, .waiting)
    XCTAssertEqual(waiting.action?.isEnabled, true)
    XCTAssertEqual(sending.action?.isEnabled, false, "Nothing more to try while it's being sent")
  }

  /// A hand-in that timed out waiting on an answer that keeps failing is that one failure, so the
  /// answer's own note and its "Try again" stay.
  func testAHandInThatTimedOutOnAnUnsavedAnswerKeepsItsTryAgain() throws {
    for save in [MockDraftQueue.Status.retrying, .resending] {
      let note = try XCTUnwrap(note(failed: true, save: save))

      XCTAssertEqual(note.tone, .waiting)
      XCTAssertEqual(note.politeLine, "Try again before you move on")
      XCTAssertNotNil(note.action)
    }

    XCTAssertEqual(note(failed: true, save: .saving)?.tone, .failure)
  }

  /// A slow step says what it's doing, as the web's: starting the next section hands nothing in.
  func testASlowStepSaysWhatItIsDoing() {
    func line(_ step: MockRun.Step) -> String? {
      MockRun.barNote(failed: false, save: .saved, slow: step) {}?.politeLine
    }

    XCTAssertEqual(line(.submit), "Still handing it in. This is taking longer than usual.")
    XCTAssertEqual(line(.endBreak), "Still starting. This is taking longer than usual.")
    XCTAssertEqual(line(.startSpeaking), "Still starting. This is taking longer than usual.")
    XCTAssertEqual(line(.finish), "This is taking longer than usual.")
  }

  private func note(failed: Bool = false, save: MockDraftQueue.Status) -> BarNote? {
    MockRun.barNote(failed: failed, save: save, slow: nil) {}
  }
}

@MainActor
final class MockAnswerSheetTests: XCTestCase {
  /// The web's one sentence for blank and not-sure questions, each counted in its own plural.
  func testHandingInSaysBlankAndNotSureInOneSentence() {
    func leftOpen(blank: Int, unsure: Int) -> String {
      String(
        localized: "\(blank) questions are blank and you're not sure of \(unsure).", table: "Mock")
    }

    XCTAssertEqual(leftOpen(blank: 1, unsure: 3), "1 question is blank and you're not sure of 3.")
    XCTAssertEqual(leftOpen(blank: 2, unsure: 1), "2 questions are blank and you're not sure of 1.")
    XCTAssertEqual(
      String(localized: "You're not sure of \(1) answers.", table: "Mock"),
      "You're not sure of 1 answer.")
  }

  /// Beside the sheet's title, as the web's: how many of the section's questions are answered.
  func testTheSheetSaysHowManyQuestionsAreAnswered() {
    XCTAssertEqual(String(localized: MockLabels.answered(0)), "0 answered")
    XCTAssertEqual(String(localized: MockLabels.answered(1)), "1 answered")
    XCTAssertEqual(String(localized: MockLabels.answered(2)), "2 answered")
  }

  /// A question the learner can't go back to reads as dimmed, as it's drawn.
  func testALockedQuestionReadsAsDimmed() async throws {
    try await readsWhatVoiceOverReads()
    let window = try show(
      List {
        MockSheetRow(
          name: "Question 1", answered: true, unsure: false, isCurrent: false, canOpen: false
        ) {}
        MockSheetRow(
          name: "Question 2", answered: false, unsure: false, isCurrent: true, canOpen: true
        ) {}
      }
      .zoonkStyles())
    try await waitForLayout(in: window)

    let rows = accessibilityElements(in: window)
    let locked = try XCTUnwrap(rows.first { $0.accessibilityLabel == "Question 1" })
    let current = try XCTUnwrap(rows.first { $0.accessibilityLabel == "Question 2" })

    XCTAssertTrue(locked.accessibilityTraits.contains(.notEnabled), "The locked row isn't dimmed")
    XCTAssertTrue(locked.accessibilityTraits.contains(.button), "The locked row isn't a button")
    XCTAssertFalse(current.accessibilityTraits.contains(.notEnabled), "The current row is dimmed")
    XCTAssertTrue(
      current.accessibilityTraits.contains([.button, .selected]),
      "The current row isn't a selected button")
  }
}

@MainActor
private final class Recorder {
  var items: [MockDraft] = []
}

@MainActor
private final class Gate {
  private var isOpen = false

  func open() { isOpen = true }

  func wait(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition("The draft gate was never released") { self.isOpen }
  }
}

@MainActor
final class MockRunKeptAnswersTests: XCTestCase {
  private static let blockId = "01a18235-e60e-7dbb-a938-b0ae54987c58"
  private static let itemOne = "11111111-1111-4111-8111-111111111111"
  private static let itemTwo = "22222222-2222-4222-8222-222222222222"
  private static let itemThree = "55555555-5555-4555-8555-555555555555"

  private lazy var defaults: UserDefaults = {
    let suite = "MockRunKeptAnswersTests.\(UUID().uuidString)"
    addTeardownBlock { UserDefaults.standard.removePersistentDomain(forName: suite) }
    return UserDefaults(suiteName: suite)!
  }()

  private var unsent: UnsentMockDrafts {
    UnsentMockDrafts(blockId: Self.blockId, defaults: defaults)
  }

  func testANewerAnswerKeepsItsPlaceOnlyWhileTheOlderOneIsStillInLine() {
    let first = MockDraft(answer: .choice(0), durationMs: 0, unsure: false, itemId: Self.itemOne)
    let second = MockDraft(answer: .choice(1), durationMs: 0, unsure: false, itemId: Self.itemTwo)
    var newer = first
    newer.answer = .choice(2)

    unsent.keep(first, inPlace: false)
    unsent.keep(second, inPlace: false)
    unsent.keep(newer, inPlace: true)
    XCTAssertEqual(unsent.read().map(\.itemId), [Self.itemOne, Self.itemTwo])

    unsent.keep(first, inPlace: false)
    XCTAssertEqual(unsent.read().map(\.itemId), [Self.itemTwo, Self.itemOne])
  }

  func testAnAnswerKeptWhenClosingOfflineGoesOutWhenTheMockOpensAgain() async throws {
    let transport = MockTransport(itemIds: [Self.itemOne, Self.itemTwo])
    let store = makeStore(transport, session: .preview(account: .keptAnswersFixture))
    let firstVisit = try await open(store)
    firstVisit.show(Self.itemOne)

    await transport.setOffline(true)
    firstVisit.answer(.choice(1))
    try await waitForTestCondition("The answer never waited to go again") {
      firstVisit.queue.status == .retrying
    }
    firstVisit.queue.stop()
    XCTAssertEqual(unsent.read().map(\.answer), [.choice(1)])

    await transport.setOffline(false)
    let reopened = try await open(store)
    await reopened.queue.idle()

    XCTAssertEqual(reopened.drafts[Self.itemOne]?.answer, .choice(1))
    XCTAssertTrue(reopened.isCountedAsAnswered(Self.itemOne))
    let saved = await transport.saved
    XCTAssertEqual(saved.map(\.answer), [.choice(1)])
    XCTAssertTrue(unsent.read().isEmpty)
    let fetches = await transport.fetches
    XCTAssertEqual(fetches, 2, "Opening again reads the mock again")
  }

  func testWrittenTextIsKeptBeforeDebounceAndSentWithItsOriginalEditOnReopen() async throws {
    let transport = MockTransport(itemIds: [Self.itemOne], format: "essay")
    let store = makeStore(transport, session: .preview(account: .keptAnswersFixture))
    let firstVisit = try await open(store)
    let question = try XCTUnwrap(firstVisit.question)
    XCTAssertEqual(question.format, .essay)
    firstVisit.show(Self.itemOne)
    firstVisit.write(.text("A first paragraph."))
    let edit = try XCTUnwrap(unsent.read().first?.edit)
    firstVisit.stop()

    let reopened = try await open(store)
    await reopened.queue.idle()

    let saved = await transport.saved
    XCTAssertEqual(saved.map(\.answer), [.text("A first paragraph.")])
    XCTAssertEqual(saved.first?.edit, edit)
    XCTAssertTrue(unsent.read().isEmpty)
  }

  func testAnAnswerWhoseSessionEndedStaysKeptAndUnsaved() async throws {
    let transport = MockTransport(itemIds: [Self.itemOne])
    let session = SessionStore.preview(account: .keptAnswersFixture)
    let run = try await open(makeStore(transport, session: session))
    run.show(Self.itemOne)

    await transport.endSession()
    run.answer(.choice(1))
    try await waitForTestCondition("The answer never waited to go again") {
      run.queue.status == .retrying
    }

    XCTAssertNil(session.authenticatedSession)
    XCTAssertFalse(run.isCountedAsAnswered(Self.itemOne))
    XCTAssertEqual(unsent.read().map(\.answer), [.choice(1)])
    run.queue.stop()
  }

  func testAnAnswerSavedBeforeTheAccountLoadsReplacesItsOlderKeptCopy() async throws {
    unsent.keep(
      MockDraft(answer: .choice(0), durationMs: 0, unsure: false, itemId: Self.itemOne),
      inPlace: false)
    let account = HeldAccountAPI()
    let session = SessionStore(
      api: account, credentialStore: InMemorySessionCredentialStore(token: "cold-launch"),
      googleAuthentication: GoogleAuthenticationClient())
    let restoring = Task { await session.restore() }
    try await waitForTestCondition("The session never started restoring") {
      session.authenticatedSession != nil
    }
    XCTAssertNil(session.account)

    let transport = MockTransport(itemIds: [Self.itemOne])
    let store = makeStore(transport, session: session)
    let coldLaunch = try await open(store)
    coldLaunch.show(Self.itemOne)
    coldLaunch.answer(.choice(1))
    await coldLaunch.queue.idle()
    coldLaunch.queue.stop()

    account.answer(.keptAnswersFixture)
    await restoring.value
    let reopened = try await open(store)
    await reopened.queue.idle()

    XCTAssertEqual(reopened.drafts[Self.itemOne]?.answer, .choice(1))
    let saved = await transport.saved
    XCTAssertEqual(saved.last?.answer, .choice(1))
    XCTAssertTrue(unsent.read().isEmpty)
  }

  /// The server charges a review one change per question, so editing a changed answer again
  /// offline leaves the other questions' changes as they were.
  func testAKeptAnswerToAnAlreadyChangedQuestionUsesNoOtherChange() async throws {
    let stored = [Self.itemOne, Self.itemTwo, Self.itemThree].map {
      MockDraft(answer: .choice(0), durationMs: 1000, unsure: false, itemId: $0)
    }
    var changedOnce = stored[0]
    changedOnce.answer = .choice(1)
    let transport = MockTransport(
      itemIds: [Self.itemOne, Self.itemTwo, Self.itemThree], drafts: [changedOnce] + stored[1...],
      review: (allowed: 2, changed: [Self.itemOne]))
    unsent.keep(stored[0], inPlace: false)

    let run = try await open(makeStore(transport, session: .preview(account: .keptAnswersFixture)))

    XCTAssertEqual(run.position, 2)
    XCTAssertEqual(run.drafts[Self.itemOne]?.answer, .choice(0))
    XCTAssertEqual(run.moves.changesLeft, 1)
    XCTAssertTrue(run.moves.canChange(1), "Question 2 can still change")

    run.go(to: 1)
    run.answer(.choice(1))
    XCTAssertEqual(run.moves.changesLeft, 0)
    XCTAssertTrue(run.moves.canChange(0), "A changed answer changes again for free")

    await run.queue.idle()
    let saved = await transport.saved
    XCTAssertEqual(saved.map(\.itemId).first, Self.itemOne)
    run.queue.stop()
  }

  func testAKeptChangeTheServerHasNoChangeLeftForStaysLocked() async throws {
    let stored = [Self.itemOne, Self.itemTwo, Self.itemThree].map {
      MockDraft(answer: .choice(0), durationMs: 1000, unsure: false, itemId: $0)
    }
    var keptChange = stored[0]
    keptChange.answer = .choice(1)
    let transport = MockTransport(
      itemIds: [Self.itemOne, Self.itemTwo, Self.itemThree], drafts: stored,
      review: (allowed: 1, changed: [Self.itemTwo]))
    unsent.keep(keptChange, inPlace: false)

    let run = try await open(makeStore(transport, session: .preview(account: .keptAnswersFixture)))

    XCTAssertEqual(run.moves.changesLeft, 0)
    XCTAssertFalse(run.moves.canChange(0), "No change was left for question 1")
    XCTAssertTrue(run.moves.canChange(1), "Question 2's change was already used on it")
    run.queue.stop()
  }

  func testAFinishedMockClearsItsKeptAnswers() async throws {
    unsent.keep(
      MockDraft(answer: .choice(0), durationMs: 0, unsure: false, itemId: Self.itemOne),
      inPlace: false)
    let transport = MockTransport(itemIds: [Self.itemOne], status: "finished")

    _ = try await open(makeStore(transport, session: .preview(account: .keptAnswersFixture)))

    XCTAssertTrue(unsent.read().isEmpty)
    let saved = await transport.saved
    XCTAssertTrue(saved.isEmpty)
  }

  private func makeStore(_ transport: MockTransport, session: SessionStore) -> ExamStore {
    ExamStore(
      api: ExamAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: transport)),
      cache: AppCache(session: session))
  }

  private func open(_ store: ExamStore) async throws -> MockRun {
    let run = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await run.mock.load()
    run.adopt(try XCTUnwrap(run.view))
    return run
  }
}

/// Holds `/me` until the test answers it, as a cold launch does before the account loads.
private struct HeldAccountAPI: AccountAPIClient {
  private let answers = AsyncStream.makeStream(of: CurrentAccount.self)

  func answer(_ account: CurrentAccount) {
    answers.continuation.yield(account)
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    for await account in answers.stream {
      return account
    }

    throw CancellationError()
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws -> String
  {
    throw AccountAPIError.invalidResponse
  }

  func signOut(token: String) async throws {}

  func synchronizeAppleSubscription(token: String, signedTransaction: String) async throws
    -> AppleSubscriptionSynchronization
  {
    throw AccountAPIError.invalidResponse
  }
}

/// Serves one mock and stores its answers, as the API does, so opening it again shows them.
private actor MockTransport: ClientTransport {
  private let itemIds: [String]
  private let drafts: [MockDraft]
  private let review: (allowed: Int, changed: [String])?
  private let status: String
  private let format: String
  private var offline = false
  private var sessionEnded = false
  private(set) var saved: [MockDraft] = []
  private(set) var fetches = 0

  init(
    itemIds: [String], drafts: [MockDraft] = [], review: (allowed: Int, changed: [String])? = nil,
    status: String = "running", format: String = "multipleChoice"
  ) {
    self.itemIds = itemIds
    self.drafts = drafts
    self.review = review
    self.status = status
    self.format = format
  }

  func setOffline(_ value: Bool) {
    offline = value
  }

  func endSession() {
    sessionEnded = true
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let json: HTTPFields = [.contentType: "application/json"]

    if sessionEnded {
      return (
        HTTPResponse(status: .unauthorized, headerFields: json),
        HTTPBody(#"{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}"#)
      )
    }

    if operationID == "getMock" {
      fetches += 1
      return (HTTPResponse(status: .ok, headerFields: json), HTTPBody(mockJSON()))
    }

    if offline {
      throw URLError(.notConnectedToInternet)
    }

    if let body {
      let data = try await Data(collecting: body, upTo: 1 << 20)
      saved.append(try JSONDecoder().decode(MockDraft.self, from: data))
    }

    return (HTTPResponse(status: .noContent), nil)
  }

  private func mockJSON() -> String {
    var current = drafts

    for draft in saved {
      current.removeAll { $0.itemId == draft.itemId }
      current.append(draft)
    }

    let draftsJSON = String(decoding: try! JSONEncoder().encode(current), as: UTF8.self)
    let changedJSON = String(
      decoding: try! JSONEncoder().encode(review?.changed ?? []), as: UTF8.self)
    let changesLeft = review.map { String($0.allowed - $0.changed.count) } ?? "null"
    let navigation =
      review.map {
        #"{"answerChanges":\#($0.allowed),"forwardOnly":true,"itemSeconds":null,"mustAnswer":false}"#
      } ?? "null"
    let resume = review == nil ? 0 : itemIds.count - 1
    let questions = itemIds.enumerated().map { index, id in
      """
      {"area":null,"context":null,"entry":null,"format":"\(format)","image":null,"itemId":"\(id)","number":\(index + 1),"options":["Alpha","Beta"],"question":"Question \(index + 1)","select":null,"set":null,"skillId":"33333333-3333-4333-8333-333333333333","unit":null,"visual":null}
      """
    }.joined(separator: ",")
    let currentJSON =
      status == "running"
      ? """
      {"changedItemIds":\(changedJSON),"changesLeft":\(changesLeft),"deadline":"2030-01-01T00:00:00.000Z","drafts":\(draftsJSON),"kind":null,"plays":[],"questions":[\(questions)],"resume":\(resume),"section":0}
      """
      : "null"

    return """
      {
        "adapt": null, "blockId": "01a18235-e60e-7dbb-a938-b0ae54987c58", "brainPower": 0,
        "breakUntil": null, "canMove": false, "ceremony": null, "certificates": [], "checklist": [],
        "current": \(currentJSON), "date": "2026-10-29", "day": null, "essayRubric": null,
        "essays": [], "examDocument": "notice", "examName": "Sample Exam", "examQuestions": null,
        "fullLength": true, "goalId": "44444444-4444-4444-8444-444444444444", "leftOut": [],
        "minutes": 30, "missionMoment": null, "mistakes": [], "number": 1, "passMarks": null,
        "planItemId": null, "purpose": "practice", "questions": \(itemIds.count),
        "reached": {"energy": null, "level": null}, "result": null, "reusedQuestions": 0,
        "review": [], "scoreNotes": {"noticeScoring": null, "relative": false, "scale": null},
        "scoring": "raw", "scoringNote": null,
        "sections": [
          {
            "breakAfterMinutes": null, "essays": 0, "index": 0, "minutes": 30, "name": "Part 1",
            "navigation": \(navigation), "questions": \(itemIds.count), "status": "current",
            "tools": null
          }
        ],
        "sessionId": null, "shape": {"area": null, "day": 1, "kind": "full"},
        "sizeSource": {
          "formats": null, "material": false, "pastEdition": null, "questions": "notice",
          "subjects": null, "time": "notice"
        },
        "speaking": null, "startTime": null, "status": "\(status)", "timeZone": "UTC",
        "trueFalseLabels": "trueFalse", "verdict": null
      }
      """
  }
}

extension CurrentAccount {
  fileprivate static let keptAnswersFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "kept-answers-learner", image: nil, name: "Learner",
      username: "learner"))
}
