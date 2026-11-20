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
      answered: false, changed: [], changesLeft: nil, navigation: nil, position: 0, reached: 0,
      total: 5)

    XCTAssertTrue(moves.canOpen(4))
    XCTAssertTrue(moves.canOpen(0))
    XCTAssertFalse(moves.canOpen(5), "No question past the section")
    XCTAssertTrue(moves.canChange(2))
    XCTAssertNil(moves.itemSeconds)
  }

  func testAForwardOnlySectionOpensOnlyTheNextQuestionAndKeepsEarlierAnswers() {
    let moves = MockSectionMoves(
      answered: true, changed: [], changesLeft: 2, navigation: forwardOnly, position: 2,
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
      answered: true, changed: [1], changesLeft: 2, navigation: forwardOnly, position: 4,
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
      answered: true, changed: [0, 1], changesLeft: 2, navigation: forwardOnly, position: 4,
      reached: 4, total: 5)

    XCTAssertEqual(moves.changesLeft, 0)
    XCTAssertFalse(moves.canChange(2))
    XCTAssertTrue(moves.canChange(1))
  }

  func testMustAnswerWaitsForAnAnswerButATimeOutMovesOn() {
    let navigation = MockSection.Navigation(
      answerChanges: nil, forwardOnly: true, itemSeconds: 60, mustAnswer: true)
    let moves = MockSectionMoves(
      answered: false, changed: [], changesLeft: nil, navigation: navigation, position: 0,
      reached: 0, total: 3)

    XCTAssertFalse(moves.canAdvance)
    XCTAssertFalse(moves.canOpen(1))
    XCTAssertTrue(moves.canOpenAfterTimeout(1))
    XCTAssertFalse(moves.canOpenAfterTimeout(2))
  }
}

@MainActor
final class MockDraftQueueTests: XCTestCase {
  private func draft(_ itemId: String, _ answer: PracticeAnswer?) -> MockDraft {
    MockDraft(answer: answer, durationMs: 0, flagged: false, itemId: itemId)
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

    var flagged = storedAnswer
    flagged.flagged = true
    queue.add(flagged)
    await queue.idle()
    XCTAssertTrue(queue.countsTowardsProgress(flagged, initiallyStored: storedAnswer))
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
    var kept: [[MockDraft]] = []
    var queue: MockDraftQueue?
    queue = MockDraftQueue(
      retryDelay: { _ in .milliseconds(10) },
      onPendingChange: { kept.append(queue?.pending ?? []) },
      save: { _ in
        saves += 1
        await gate.wait()
        return .unreachable
      })

    queue?.add(draft("a", .choice(0)))
    _ = try? await waitForTestCondition("Fixture state did not arrive") { !(saves == 0) }
    let updatesBeforeStop = kept.count
    queue?.stop()
    gate.open()
    await queue?.idle()

    XCTAssertEqual(saves, 1)
    XCTAssertEqual(queue?.status, .saved)
    XCTAssertEqual(kept.count, updatesBeforeStop, "Stopping must not wipe kept device drafts")
    XCTAssertEqual(kept.last, [draft("a", .choice(0))])
  }

  func testPendingKeepsTheNewestAnswerForEachQuestionUntilStored() async {
    let gate = Gate()
    var kept: [[MockDraft]] = []
    var queue: MockDraftQueue?
    queue = MockDraftQueue(
      onPendingChange: { kept.append(queue?.pending ?? []) },
      save: { _ in
        await gate.wait()
        return .stored
      })

    queue?.add(draft("a", .choice(0)))
    queue?.add(draft("b", .choice(1)))
    queue?.add(draft("a", .choice(2)))

    XCTAssertEqual(queue?.pending, [draft("a", .choice(2)), draft("b", .choice(1))])
    XCTAssertEqual(kept.last, [draft("a", .choice(2)), draft("b", .choice(1))])

    gate.open()
    await queue?.idle()
    XCTAssertEqual(kept.last, [])
  }

  func testASessionChangeStopsTheQueueWithoutClearingKeptAnswers() async {
    var sent: [String] = []
    var kept: [[MockDraft]] = []
    var queue: MockDraftQueue?
    queue = MockDraftQueue(
      onPendingChange: { kept.append(queue?.pending ?? []) },
      save: { draft in
        sent.append(draft.itemId)
        return .stop
      })

    queue?.add(draft("a", .choice(0)))
    queue?.add(draft("b", .choice(1)))
    await queue?.idle()

    XCTAssertEqual(sent, ["a"])
    XCTAssertEqual(kept.last, [draft("a", .choice(0)), draft("b", .choice(1))])
    XCTAssertEqual(queue?.status, .saved)
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
  /// The web's one sentence for blank and flagged questions, each counted in its own plural.
  func testHandingInSaysBlankAndFlaggedInOneSentence() {
    func leftOpen(blank: Int, flagged: Int, locale: String = "en") -> String {
      var sentence = LocalizedStringResource(
        "\(blank) questions are blank and \(flagged) are flagged.", table: "Mock")
      sentence.locale = Locale(identifier: locale)
      return String(localized: sentence)
    }

    XCTAssertEqual(leftOpen(blank: 2, flagged: 1), "2 questions are blank and 1 is flagged.")
    XCTAssertEqual(leftOpen(blank: 1, flagged: 3), "1 question is blank and 3 are flagged.")
    XCTAssertEqual(
      leftOpen(blank: 1, flagged: 2, locale: "pt"),
      "1 questão está em branco e 2 estão marcadas.", "The web's words")
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
          name: "Question 1", answered: true, flagged: false, isCurrent: false, canOpen: false
        ) {}
        MockSheetRow(
          name: "Question 2", answered: false, flagged: false, isCurrent: true, canOpen: true
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
final class MockRunOfflinePersistenceTests: XCTestCase {
  private static let baseURL = URL(string: "https://api.zoonk.test")!
  private static let blockId = "01a18235-e60e-7dbb-a938-b0ae54987c58"
  private static let itemOne = "11111111-1111-4111-8111-111111111111"
  private static let itemTwo = "22222222-2222-4222-8222-222222222222"

  private func makeDefaults() -> (UserDefaults, String) {
    let suite = "MockRunOfflinePersistenceTests.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    return (defaults, suite)
  }

  private func makeStore(transport: MockOfflineTransport) -> ExamStore {
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    return ExamStore(
      api: api, cache: AppCache(session: .preview(account: .mockOfflineTestFixture)))
  }

  func testClosingWhileOfflineKeepsTheAnswerAndSendsItWhenTheMockReopens() async throws {
    let (defaults, suite) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suite) }

    let transport = MockOfflineTransport(
      blockId: Self.blockId, itemIds: [Self.itemOne, Self.itemTwo])
    let store = makeStore(transport: transport)

    let firstVisit = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await firstVisit.mock.load()
    let loaded = try XCTUnwrap(firstVisit.view)
    firstVisit.adopt(loaded)
    firstVisit.show(Self.itemOne)

    await transport.setOffline(true)
    firstVisit.answer(.choice(1))
    _ = try? await waitForTestCondition("Offline answer did not enter retrying") {
      firstVisit.queue.status == .retrying
    }

    // Closing while offline stops the in-memory queue, leaving the unsent draft on the device.
    firstVisit.queue.stop()

    let keptBeforeReopen = UnsentMockDrafts(
      learnerId: CurrentAccount.mockOfflineTestFixture.user.id,
      blockId: Self.blockId,
      defaults: defaults
    ).read()
    XCTAssertEqual(keptBeforeReopen.map(\.itemId), [Self.itemOne])
    XCTAssertEqual(keptBeforeReopen.first?.answer, .choice(1))

    // Back online, reopening the mock reads fresh from the server and sends the kept answer.
    await transport.setOffline(false)
    let secondVisit = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await secondVisit.mock.load()
    let reloaded = try XCTUnwrap(secondVisit.view)
    secondVisit.adopt(reloaded)
    secondVisit.show(Self.itemOne)
    await secondVisit.queue.idle()

    XCTAssertEqual(secondVisit.drafts[Self.itemOne]?.answer, .choice(1))
    XCTAssertTrue(secondVisit.isCountedAsAnswered(Self.itemOne))

    let savedOnServer = await transport.savedAnswers()
    XCTAssertEqual(savedOnServer.map(\.itemId), [Self.itemOne])
    XCTAssertEqual(savedOnServer.first?.answer, .choice(1))

    let keptAfterSave = UnsentMockDrafts(
      learnerId: CurrentAccount.mockOfflineTestFixture.user.id,
      blockId: Self.blockId,
      defaults: defaults
    ).read()
    XCTAssertTrue(keptAfterSave.isEmpty)

    let fetchCount = await transport.mockFetches()
    XCTAssertEqual(fetchCount, 2, "Reopening must read the mock fresh from the server")
  }

  func testTypingIsKeptOnTheDeviceBeforeThePauseFires() async throws {
    let (defaults, suite) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suite) }

    let transport = MockOfflineTransport(
      blockId: Self.blockId, itemIds: [Self.itemOne], format: "typed")
    let store = makeStore(transport: transport)

    let run = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await run.mock.load()
    run.adopt(try XCTUnwrap(run.view))
    run.show(Self.itemOne)

    run.write(.text("Paris"))

    let kept = UnsentMockDrafts(
      learnerId: CurrentAccount.mockOfflineTestFixture.user.id,
      blockId: Self.blockId,
      defaults: defaults
    ).read()
    XCTAssertEqual(kept.first?.answer, .text("Paris"))
    let savedOnServer = await transport.savedAnswers()
    XCTAssertTrue(savedOnServer.isEmpty)
    run.queue.stop()
  }

  func testReopeningAForwardOnlySectionSendsTheKeptAnswerAheadOfShowing() async throws {
    let (defaults, suite) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suite) }

    let kept = MockDraft(answer: .choice(1), durationMs: 4000, flagged: true, itemId: Self.itemOne)
    UnsentMockDrafts(
      learnerId: CurrentAccount.mockOfflineTestFixture.user.id,
      blockId: Self.blockId,
      defaults: defaults
    ).write([kept])

    let transport = MockOfflineTransport(
      blockId: Self.blockId, itemIds: [Self.itemOne, Self.itemTwo], forwardOnly: true)
    let store = makeStore(transport: transport)

    let run = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await run.mock.load()
    // Calling show before adopt simulates child .onAppear running ahead of parent .onChange.
    run.show(Self.itemOne)
    run.adopt(try XCTUnwrap(run.view))
    await run.queue.idle()

    let savedOnServer = await transport.savedAnswers()
    XCTAssertEqual(savedOnServer, [kept])
    XCTAssertEqual(run.drafts[Self.itemOne], kept)
  }

  func testReopeningAFinishedMockClearsKeptAnswers() async throws {
    let (defaults, suite) = makeDefaults()
    defer { defaults.removePersistentDomain(forName: suite) }

    let unsent = UnsentMockDrafts(
      learnerId: CurrentAccount.mockOfflineTestFixture.user.id,
      blockId: Self.blockId,
      defaults: defaults
    )
    unsent.write([
      MockDraft(answer: .choice(0), durationMs: 1000, flagged: false, itemId: Self.itemOne)
    ])

    let transport = MockOfflineTransport(
      blockId: Self.blockId, itemIds: [Self.itemOne], status: "finished")
    let store = makeStore(transport: transport)

    let run = MockRun(store: store, blockId: Self.blockId, defaults: defaults)
    await run.mock.load()
    run.adopt(try XCTUnwrap(run.view))

    XCTAssertTrue(unsent.read().isEmpty)
    let savedOnServer = await transport.savedAnswers()
    XCTAssertTrue(savedOnServer.isEmpty)
  }
}

private actor MockOfflineTransport: ClientTransport {
  private let blockId: String
  private let itemIds: [String]
  private let format: String
  private let forwardOnly: Bool
  private let status: String
  private var offline = false
  private var saved: [MockDraft] = []
  private var fetches = 0

  init(
    blockId: String,
    itemIds: [String],
    format: String = "multipleChoice",
    forwardOnly: Bool = false,
    status: String = "running"
  ) {
    self.blockId = blockId
    self.itemIds = itemIds
    self.format = format
    self.forwardOnly = forwardOnly
    self.status = status
  }

  func setOffline(_ value: Bool) {
    offline = value
  }

  func savedAnswers() -> [MockDraft] {
    saved
  }

  func mockFetches() -> Int {
    fetches
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    if operationID == "getMock" {
      fetches += 1
      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(mockJSON())
      )
    }

    if operationID == "saveMockAnswer" {
      if offline {
        throw URLError(.notConnectedToInternet)
      }

      if let body {
        let data = try await Data(collecting: body, upTo: 1 << 20)
        if let decoded = try? JSONDecoder().decode(MockDraft.self, from: data) {
          saved.append(decoded)
        }
      }

      return (HTTPResponse(status: .noContent), nil)
    }

    return (HTTPResponse(status: .notFound), nil)
  }

  private func mockJSON() -> String {
    let navigationJSON =
      forwardOnly
      ? #"{"answerChanges":null,"forwardOnly":true,"itemSeconds":null,"mustAnswer":false}"#
      : "null"
    let optionsJSON = format == "multipleChoice" ? #"["Alpha","Beta"]"# : "null"
    let questionsJSON = itemIds.enumerated().map { index, id in
      """
      {"area":null,"context":null,"entry":null,"format":"\(format)","image":null,"itemId":"\(id)","number":\(index + 1),"options":\(optionsJSON),"question":"Question \(index + 1)","select":null,"set":null,"skillId":"33333333-3333-4333-8333-333333333333","unit":null,"visual":null}
      """
    }.joined(separator: ",")
    let currentJSON =
      status == "running"
      ? """
      {"changesLeft":null,"deadline":"2030-01-01T00:00:00.000Z","drafts":[],"kind":null,"plays":[],"questions":[\(questionsJSON)],"resume":0,"section":0}
      """
      : "null"

    return """
      {
        "adapt": null,
        "blockId": "\(blockId)",
        "brainPower": 0,
        "breakUntil": null,
        "canMove": false,
        "ceremony": null,
        "certificates": [],
        "checklist": [],
        "current": \(currentJSON),
        "date": "2026-10-29",
        "day": null,
        "essayRubric": null,
        "essays": [],
        "examDocument": "notice",
        "examName": "Sample Exam",
        "examQuestions": null,
        "fullLength": true,
        "goalId": "44444444-4444-4444-8444-444444444444",
        "leftOut": [],
        "minutes": 30,
        "missionMoment": null,
        "mistakes": [],
        "number": 1,
        "passMarks": null,
        "planItemId": null,
        "purpose": "practice",
        "questions": \(itemIds.count),
        "reached": {"energy": null, "level": null},
        "result": null,
        "reusedQuestions": 0,
        "review": [],
        "scoreNotes": {"noticeScoring": null, "relative": false, "scale": null},
        "scoring": "raw",
        "scoringNote": null,
        "sections": [
          {
            "breakAfterMinutes": null,
            "essays": 0,
            "index": 0,
            "minutes": 30,
            "name": "Part 1",
            "navigation": \(navigationJSON),
            "questions": \(itemIds.count),
            "status": "current",
            "tools": null
          }
        ],
        "sessionId": null,
        "shape": {"area": null, "day": 1, "kind": "full"},
        "sizeSource": {"formats": null, "material": false, "pastEdition": null, "questions": "notice", "subjects": null, "time": "notice"},
        "speaking": null,
        "startTime": null,
        "status": "\(status)",
        "timeZone": "UTC",
        "trueFalseLabels": "trueFalse",
        "verdict": null
      }
      """
  }
}

extension CurrentAccount {
  fileprivate static let mockOfflineTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "mock-offline-test-user",
      image: nil, name: "Learner", username: "learner"))
}
