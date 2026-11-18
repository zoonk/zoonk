import XCTest

@testable import Zoonk

@MainActor
final class SettingsStoreTests: XCTestCase {
  func testAnUnansweredProfileQuestionDoesNotSaveAnEmptyDraft() async {
    let question = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: [], studies: [], text: ""), status: nil,
      version: 1)
    let store = makeStore(api: SettingsAPIStub(profileQuestion: question))
    await store.profileQuestions.load()
    var draft = ProfileDraft(question)
    draft.text = "  "

    let saved = await store.answerProfileQuestion(draft)

    XCTAssertFalse(saved)
  }

  func testAnAnsweredProfileQuestionCanBeCleared() async {
    let question = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: ["figma"], studies: [], text: ""),
      status: .answered, version: 1)
    let store = makeStore(api: SettingsAPIStub(profileQuestion: question))
    await store.profileQuestions.load()
    var draft = ProfileDraft(question)
    draft.toggle("figma")

    let saved = await store.answerProfileQuestion(draft)

    XCTAssertTrue(saved)
  }

  /// An answer whose facts were deleted in Memory opens empty; Save waits for a change.
  func testAboutYouSaveWaitsForAChange() {
    let emptied = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: [], studies: [], text: ""),
      status: .answered, version: 1)
    var picked = ProfileDraft(emptied)
    picked.toggle("figma")

    XCTAssertFalse(ProfileDraft(emptied).savesAChange(emptied))
    XCTAssertTrue(picked.savesAChange(emptied))

    let answered = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: ["figma"], studies: [], text: ""),
      status: .answered, version: 1)
    var cleared = ProfileDraft(answered)
    cleared.toggle("figma")

    XCTAssertFalse(ProfileDraft(answered).savesAChange(answered))
    XCTAssertTrue(cleared.savesAChange(answered))
  }

  /// Unticking a pick and ticking it again puts it last, but the answer is the one saved.
  func testAboutYouSaveStaysOffAfterPuttingBackTheSamePicks() {
    let answered = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: ["figma", "sketch"], studies: [], text: ""),
      status: .answered, version: 1)
    var draft = ProfileDraft(answered)
    draft.toggle("figma")

    XCTAssertTrue(draft.savesAChange(answered))

    draft.toggle("figma")

    XCTAssertFalse(draft.savesAChange(answered))
  }

  /// The job field hides again once the status has no work in it, so its text isn't saved.
  func testAboutYouSaveStaysOffWhenOnlyAHiddenJobChanged() {
    let saved = ProfileQuestionView(
      id: .work, options: [], saved: .init(picks: ["student"], studies: [], text: ""),
      status: .answered, version: 1)
    var draft = ProfileDraft(saved)
    draft.toggle("work")
    draft.text = "Dev"
    draft.toggle("student")

    XCTAssertFalse(draft.savesAChange(saved))
  }

  /// A field picked, given an empty subject and unpicked again leaves the saved studies as they were.
  func testAboutYouSaveStaysOffAfterAnEmptySubjectIsLeftBehind() {
    let saved = ProfileQuestionView(
      id: .studies, options: [],
      saved: .init(picks: [], studies: [.init(field: "math", subject: "Algebra")], text: ""),
      status: .answered, version: 1)
    var draft = ProfileDraft(saved)
    draft.toggle("physics")
    draft.subjects["physics"] = ""
    draft.toggle("physics")

    XCTAssertFalse(draft.savesAChange(saved))
  }

  /// Saving trims what's typed, so a trailing space saves the same favorites.
  func testAboutYouSaveStaysOffForATrailingSpace() {
    let saved = ProfileQuestionView(
      id: .tools, options: [], saved: .init(picks: [], studies: [], text: "Chess"),
      status: .answered, version: 1)
    var draft = ProfileDraft(saved)
    draft.text = "Chess "

    XCTAssertFalse(draft.savesAChange(saved))
  }

  func testSavedPreferenceShowsTheServerReply() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.preferences.load()

    let saved = await store.updatePreferences(.soundsEnabled(false))

    XCTAssertEqual(store.preferences.value?.soundsEnabled, false)
    let updates = await api.updates
    XCTAssertEqual(updates, [.soundsEnabled(false)])
    XCTAssertTrue(saved)
  }

  func testRefusedPreferenceGoesBackAndSaysSo() async {
    let api = SettingsAPIStub(updateError: APIError.unavailable)
    let store = makeStore(api: api)
    await store.preferences.load()

    let saved = await store.updatePreferences(.soundsEnabled(false))

    XCTAssertEqual(store.preferences.value?.soundsEnabled, true)
    XCTAssertFalse(saved)
  }

  /// The buddy offers a country before any screen read the preferences.
  func testAPreferenceSavedBeforeItLoadedReachesTheServer() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let portugal = CountryChoice(code: "PT", name: "Portugal")

    let saved = await store.updatePreferences(.homeCountry(portugal))

    XCTAssertTrue(saved)
    let updates = await api.updates
    XCTAssertEqual(updates, [.homeCountry(portugal)])
    XCTAssertEqual(store.preferences.value?.homeCountry?.code, "PT")
  }

  func testAPreferenceThatCouldNotLoadSaysItDidNotSave() async {
    let api = SettingsAPIStub(preferencesError: APIError.unavailable)
    let store = makeStore(api: api)

    let saved = await store.updatePreferences(
      .homeCountry(CountryChoice(code: "PT", name: "Portugal")))

    XCTAssertFalse(saved)
    let updates = await api.updates
    XCTAssertEqual(updates, [])
  }

  func testPreferencesChosenWhileTheyLoadSaveInTheOrderChosen() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await api.holdPreferences(for: "preview-session")

    let portugal = PreferencesUpdate.homeCountry(CountryChoice(code: "PT", name: "Portugal"))
    let brazil = PreferencesUpdate.homeCountry(CountryChoice(code: "BR", name: "Brazil"))

    let first = Task { await store.updatePreferences(portugal) }
    await api.waitForHeldPreferences()
    let second = Task { await store.updatePreferences(brazil) }
    for _ in 0..<10 {
      await Task.yield()
    }
    await api.releasePreferences()
    _ = await first.value
    _ = await second.value

    let updates = await api.updates
    XCTAssertEqual(updates, [portugal, brazil])
    XCTAssertEqual(store.preferences.value?.homeCountry?.code, "BR")
  }

  func testAPreferenceChosenBeforeTheNextLearnerSignedInIsNotSavedAsTheirs() async {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner-a")
    let cache = AppCache(session: session)
    let api = SettingsAPIStub()
    let store = SettingsStore(api: api, cache: cache)
    await api.holdPreferences(for: "token-learner-a")

    let save = Task {
      await store.updatePreferences(.homeCountry(CountryChoice(code: "PT", name: "Portugal")))
    }
    await api.waitForHeldPreferences()
    await accounts.signIn(session, as: "learner-b")
    cache.followSession()
    await store.preferences.load()
    await api.releasePreferences()
    _ = await save.value

    let tokens = await api.updateTokens
    XCTAssertEqual(tokens, [])
    XCTAssertNil(store.preferences.value?.homeCountry)
  }

  func testAFailedSaveLeavesALaterChangeOfTheSameSetting() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.preferences.load()
    await api.hold(.soundsEnabled(false))

    let first = Task { await store.updatePreferences(.soundsEnabled(false)) }
    await api.waitForHeldUpdate()
    let second = Task { await store.updatePreferences(.soundsEnabled(true)) }
    await waitUntil { store.preferences.value?.soundsEnabled == true }
    await api.releaseHeldUpdate(throwing: APIError.unavailable)
    _ = await first.value
    _ = await second.value

    XCTAssertEqual(store.preferences.value?.soundsEnabled, true)
    let updates = await api.updates
    XCTAssertEqual(updates, [.soundsEnabled(false), .soundsEnabled(true)], "sent in order")
  }

  func testTwoFailedSavesShowWhatTheServerHas() async {
    let api = SettingsAPIStub(updateError: APIError.unavailable)
    let store = makeStore(api: api)
    await store.preferences.load()
    await api.hold(.soundsEnabled(false))

    let first = Task { await store.updatePreferences(.soundsEnabled(false)) }
    await api.waitForHeldUpdate()
    let second = Task { await store.updatePreferences(.soundsEnabled(true)) }
    await waitUntil { store.preferences.value?.soundsEnabled == true }
    await api.releaseHeldUpdate(throwing: APIError.unavailable)
    _ = await first.value
    _ = await second.value

    XCTAssertEqual(store.preferences.value?.soundsEnabled, true, "neither limit saved")
  }

  func testAFailedEditLeavesAFactDeletedAfterIt() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.memory.load()
    await api.holdEdits()

    let edit = Task { await store.updateMemoryFact(id: MemoryFact.sciFi.id, statement: "Reads") }
    await api.waitForHeldEdit()
    let deletion = Task { await store.deleteMemoryFact(id: MemoryFact.evenings.id) }
    await waitUntil { store.memory.value?.facts.count == 1 }
    await api.releaseEdits(throwing: APIError.network)
    await edit.value
    await deletion.value

    XCTAssertEqual(store.memory.value?.facts, [.sciFi], "the deleted fact stays deleted")
  }

  func testAnUndoAnsweredAfterAnotherDeletionLeavesThatOneUndoable() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }
    await api.holdDeletes()

    changes.delete(id: MemoryFact.sciFi.id, settings: store)
    await api.waitForHeldDelete()
    changes.undo(settings: store)
    await api.releaseDeletes(throwing: nil)
    await waitUntil { store.memory.value?.facts == [.evenings] }
    await waitUntil { changes.deletedFact == .sciFi }

    XCTAssertEqual(changes.deletedFact, .sciFi)
    XCTAssertNil(changes.undoStatus, "the later deletion can still be undone")
  }

  func testDeletedFactLeavesTheListAndCanComeBack() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.memory.load()

    let deletion = await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    XCTAssertEqual(store.memory.value?.facts, [.sciFi])
    guard case .done(let deleted)? = deletion else {
      return XCTFail("Expected the deleted fact, got \(String(describing: deletion))")
    }
    XCTAssertEqual(deleted, .evenings)

    let undo = await store.undoDeletion(of: deleted)

    XCTAssertEqual(store.memory.value?.facts, [.sciFi, .evenings])
    XCTAssertEqual(undo, .undone)
    let restoredFactIds = await api.restoredFactIds
    XCTAssertEqual(restoredFactIds, [MemoryFact.evenings.id])
  }

  func testASecondUndoTapWhileTheFirstRunsRestoresNothingMore() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }

    changes.undo(settings: store)
    changes.undo(settings: store)
    await waitUntil { changes.undoStatus == .undone }

    XCTAssertEqual(changes.undoStatus, .undone)
    let restoredFactIds = await api.restoredFactIds
    XCTAssertEqual(restoredFactIds, [MemoryFact.evenings.id])
  }

  func testFailedDeletionKeepsTheFactAndSaysSo() async {
    let store = makeStore(api: SettingsAPIStub(deleteError: APIError.network))
    let changes = MemoryChanges()
    await store.memory.load()

    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.saveFailed }

    XCTAssertEqual(store.memory.value?.facts, [.sciFi, .evenings])
    XCTAssertNil(changes.deletedFact)
    XCTAssertTrue(changes.saveFailed)
  }

  func testUndoThatChangedSinceSaysItCouldNotAndIsNotSentAgain() async {
    let api = SettingsAPIStub(restoreChangedSince: true)
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }

    changes.undo(settings: store)
    await waitUntil { changes.undoStatus == .changedSince }
    changes.undo(settings: store)

    XCTAssertEqual(changes.undoStatus, .changedSince)
    XCTAssertFalse(changes.saveFailed)
    XCTAssertEqual(store.memory.value?.facts, [.sciFi])
    let restoreCount = await api.restoreCount
    XCTAssertEqual(restoreCount, 1)
  }

  func testUndoThatDidNotGoThroughCanBeTriedAgain() async {
    let api = SettingsAPIStub(restoreError: APIError.network)
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }

    changes.undo(settings: store)
    await waitUntil { changes.undoStatus == .failed }

    XCTAssertEqual(changes.undoStatus, .failed)
    XCTAssertFalse(changes.saveFailed)
    XCTAssertEqual(store.memory.value?.facts, [.sciFi])

    changes.undo(settings: store)
    await waitUntil { changes.undoStatus == .failed }

    let restoreCount = await api.restoreCount
    XCTAssertEqual(restoreCount, 2)
  }

  /// A later change doesn't hide an earlier one that failed: the deletion fails while the switch,
  /// made after it, saves, and the page still says so (review of `697b994fb2`).
  func testAFailedDeletionStillSaysSoWhenALaterChangeSaves() async throws {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    await api.holdDeletes()

    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await api.waitForHeldDelete()
    changes.save(.memorySwitch) { await store.setMemoryEnabled(false) }
    await api.releaseDeletes(throwing: APIError.network)
    try await waitForTestCondition("The save failure did not arrive") { changes.saveFailed }

    XCTAssertTrue(changes.saveFailed)
  }

  /// A fact's edit failed, then the fact was deleted: its failure went with it, and Undo bringing
  /// the fact back doesn't bring the failure back (review of `5667281d3c`).
  func testDeletingAFactRetiresItsFailedEdit() async throws {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    await api.holdEdits()

    changes.save(.edit(MemoryFact.evenings.id)) {
      await store.updateMemoryFact(id: MemoryFact.evenings.id, statement: "Studies at dawn")
    }
    await api.waitForHeldEdit()
    await api.releaseEdits(throwing: APIError.network)
    await waitUntil { changes.saveFailed }

    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }
    XCTAssertFalse(changes.saveFailed, "the deleted fact's failed edit goes with it")

    changes.undo(settings: store)
    await waitUntil { changes.undoStatus == .undone }
    XCTAssertFalse(changes.saveFailed, "Undo brings the fact back, not its failure")
  }

  func testLeavingMemoryEndsItsNoticeAndWhatsStillOut() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    let changes = MemoryChanges()
    await store.memory.load()
    changes.delete(id: MemoryFact.evenings.id, settings: store)
    await waitUntil { changes.deletedFact == .evenings }
    await api.holdDeletes()

    changes.delete(id: MemoryFact.sciFi.id, settings: store)
    await api.waitForHeldDelete()
    changes.leave()
    await api.releaseDeletes(throwing: APIError.network)
    await waitUntil { store.memory.value?.facts == [.sciFi] }

    XCTAssertNil(changes.deletedFact)
    XCTAssertNil(changes.undoStatus)
    XCTAssertFalse(changes.saveFailed, "a failure that lands after leaving says nothing")
  }

  func testExpiredSessionSignsOutWithoutSayingTheSaveFailed() async {
    let session = SessionStore.preview(account: .settingsTestFixture)
    let store = SettingsStore(
      api: SettingsAPIStub(updateError: APIError.unauthorized), cache: AppCache(session: session))
    await store.preferences.load()

    let saved = await store.updatePreferences(.soundsEnabled(false))

    XCTAssertNil(session.account)
    XCTAssertTrue(saved, "a signed-out learner is told nothing")
  }

  func testReplyForAnEndedSessionIsDropped() async {
    let session = SessionStore.preview(account: .settingsTestFixture)
    let api = SettingsAPIStub()
    let store = SettingsStore(api: api, cache: AppCache(session: session))
    await store.memory.load()
    await api.runBeforeDelete {
      if let current = session.authenticatedSession {
        await session.expire(current)
      }
    }

    let deletion = await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    guard case .obsolete? = deletion else {
      return XCTFail("Expected nothing to say, got \(String(describing: deletion))")
    }
  }

  func testAWriteThatReturnsAfterTheNextLearnerLoadedChangesNothingOfTheirs() async {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner-a")
    let cache = AppCache(session: session)
    let api = SettingsAPIStub()
    let store = SettingsStore(api: api, cache: cache)
    await store.memory.load()
    await api.holdDeletes()

    let deletion = Task { await store.deleteMemoryFact(id: MemoryFact.evenings.id) }
    await api.waitForHeldDelete()
    await accounts.signIn(session, as: "learner-b")
    cache.followSession()
    await store.memory.load()
    let learnerBFacts = store.memory.value?.facts
    await api.releaseDeletes(throwing: APIError.network)
    let result = await deletion.value

    XCTAssertEqual(learnerBFacts, [.learnerB])
    XCTAssertEqual(store.memory.value?.facts, [.learnerB], "A's facts never come back as B's")
    guard case .obsolete? = result else {
      return XCTFail("Expected nothing to say to B, got \(String(describing: result))")
    }
  }

  private func waitUntil(
    file: StaticString = #filePath, line: UInt = #line, _ condition: () -> Bool
  ) async {
    _ = try? await waitForTestCondition("The state did not arrive", file: file, line: line) {
      condition()
    }
  }

  private func makeStore(api: SettingsAPIStub) -> SettingsStore {
    SettingsStore(
      api: api, cache: AppCache(session: SessionStore.preview(account: .settingsTestFixture)))
  }
}

private actor SettingsAPIStub: SettingsAPIClient {
  private(set) var updates: [PreferencesUpdate] = []
  private(set) var updateTokens: [String] = []
  private(set) var restoredFactIds: [String] = []
  private(set) var restoreCount = 0
  private var beforeDelete: (@MainActor @Sendable () async -> Void)?
  private var holdsDeletes = false
  private var heldDelete: TestContinuation<Void>?
  private var heldUpdate: PreferencesUpdate?
  private var heldUpdateResponse: TestContinuation<Void>?
  private var holdsEdits = false
  private var heldEdit: TestContinuation<Void>?
  private var heldPreferencesToken: String?
  private var heldPreferences: TestContinuation<Void>?

  private let preferencesError: Error?
  private let updateError: Error?
  private let deleteError: Error?
  private let restoreError: Error?
  private let restoreChangedSince: Bool
  private let profileQuestion: ProfileQuestionView?

  func runBeforeDelete(_ action: @escaping @MainActor @Sendable () async -> Void) {
    beforeDelete = action
  }

  init(
    preferencesError: Error? = nil,
    updateError: Error? = nil,
    deleteError: Error? = nil,
    restoreError: Error? = nil,
    restoreChangedSince: Bool = false,
    profileQuestion: ProfileQuestionView? = nil
  ) {
    self.preferencesError = preferencesError
    self.updateError = updateError
    self.deleteError = deleteError
    self.restoreError = restoreError
    self.restoreChangedSince = restoreChangedSince
    self.profileQuestion = profileQuestion
  }

  func getPreferences(token: String) async throws -> LearningPreferences {
    if token == heldPreferencesToken {
      heldPreferencesToken = nil
      await withTestVoidContinuation { heldPreferences = $0 }
    }

    if let preferencesError {
      throw preferencesError
    }

    return .settingsTestFixture
  }

  func updatePreferences(token: String, _ update: PreferencesUpdate) async throws
    -> LearningPreferences
  {
    updates.append(update)
    updateTokens.append(token)

    if update == heldUpdate {
      heldUpdate = nil
      try await withTestContinuation { heldUpdateResponse = $0 }
    }

    if let updateError {
      throw updateError
    }

    return update.applied(to: .settingsTestFixture)
  }

  func holdPreferences(for token: String) {
    heldPreferencesToken = token
  }

  func waitForHeldPreferences(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition(
      "waitForHeldPreferences did not arrive", file: file, line: line
    ) { await self.heldPreferences != nil }
  }

  func releasePreferences() {
    heldPreferences?.resume()
    heldPreferences = nil
  }

  func hold(_ update: PreferencesUpdate) {
    heldUpdate = update
  }

  func waitForHeldUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition("waitForHeldUpdate did not arrive", file: file, line: line)
    { await self.heldUpdateResponse != nil }
  }

  func releaseHeldUpdate(throwing error: Error) {
    heldUpdateResponse?.resume(throwing: error)
    heldUpdateResponse = nil
  }

  nonisolated func getMemory(token: String) async throws -> LearnerMemory {
    token == "token-learner-b"
      ? LearnerMemory(enabled: true, facts: [.learnerB])
      : LearnerMemory(enabled: true, facts: [.sciFi, .evenings])
  }

  nonisolated func setMemoryEnabled(token: String, _ enabled: Bool) async throws {}

  func updateMemoryFact(token: String, factId: String, statement: String) async throws
    -> MemoryFact
  {
    if holdsEdits {
      try await withTestContinuation { heldEdit = $0 }
    }

    return .evenings
  }

  func holdEdits() {
    holdsEdits = true
  }

  func waitForHeldEdit(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition("waitForHeldEdit did not arrive", file: file, line: line) {
      await self.heldEdit != nil
    }
  }

  func releaseEdits(throwing error: Error) {
    heldEdit?.resume(throwing: error)
    heldEdit = nil
  }

  func deleteMemoryFact(token: String, factId: String) async throws -> MemoryFact {
    await beforeDelete?()

    if holdsDeletes {
      try await withTestContinuation { heldDelete = $0 }
    }

    if let deleteError {
      throw deleteError
    }

    return [MemoryFact.sciFi, .evenings].first { $0.id == factId } ?? .evenings
  }

  func holdDeletes() {
    holdsDeletes = true
  }

  func waitForHeldDelete(file: StaticString = #filePath, line: UInt = #line) async {
    _ = try? await waitForTestCondition("waitForHeldDelete did not arrive", file: file, line: line)
    { await self.heldDelete != nil }
  }

  func releaseDeletes(throwing error: Error?) {
    if let error {
      heldDelete?.resume(throwing: error)
    } else {
      heldDelete?.resume()
    }

    heldDelete = nil
  }

  func restoreMemoryFact(token: String, factId: String) async throws -> [MemoryFact]? {
    restoreCount += 1

    if let restoreError {
      throw restoreError
    }

    guard !restoreChangedSince else {
      return nil
    }

    restoredFactIds.append(factId)
    return [.evenings]
  }

  nonisolated func getAllowance(token: String) async throws -> PlanAllowance {
    PlanAllowance(tier: .free, buddyMessagesToday: 1, buddyMessagesDailyLimit: 5)
  }

  nonisolated func getFreePlan() async throws -> FreePlan {
    throw APIError.unavailable
  }

  func getWebPlus(token: String) async throws -> WebPlus {
    throw APIError.notFound
  }

  nonisolated func exportMemory(token: String) async throws -> Data { Data() }

  nonisolated func getProfileQuestions(token: String) async throws -> ProfileQuestions {
    guard let profileQuestion else { throw APIError.unavailable }
    return ProfileQuestions(memoryEnabled: true, questions: [profileQuestion])
  }

  nonisolated func answerProfileQuestion(
    token: String, _ input: Components.Schemas.ProfileAnswerInput
  ) async throws -> ProfileQuestionView {
    guard let profileQuestion else { throw APIError.unavailable }
    return profileQuestion
  }

  func exportAccountData(token: String) async throws -> Data {
    Data()
  }
}

extension LearningPreferences {
  fileprivate static let settingsTestFixture = LearningPreferences(
    buddy: BuddyChoice(kind: .otto, name: nil, glasses: .round),
    buddyPicked: true,
    availableGlasses: [.round],

    soundsEnabled: true)
}

extension MemoryFact {
  fileprivate static let sciFi = MemoryFact(
    id: "fact-sci-fi", statement: "Likes science fiction", category: .preferences, source: .told,
    createdAt: Date(timeIntervalSince1970: 2_000))
  fileprivate static let learnerB = MemoryFact(
    id: "fact-learner-b", statement: "Learner B's own fact", category: .goals, source: .told,
    createdAt: Date(timeIntervalSince1970: 3_000))
  fileprivate static let evenings = MemoryFact(
    id: "fact-evenings", statement: "Studies at night", category: .routine, source: .told,
    createdAt: Date(timeIntervalSince1970: 1_000))
}

extension CurrentAccount {
  fileprivate static let settingsTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "settings-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

extension WebPlus {
  fileprivate static let renewing = WebPlus(
    state: .renewing, periodEnd: Date(timeIntervalSince1970: 2_000_000_000))
}
