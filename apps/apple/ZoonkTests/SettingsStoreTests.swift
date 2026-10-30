import XCTest

@testable import Zoonk

@MainActor
final class SettingsStoreTests: XCTestCase {
  func testSavedPreferenceShowsTheServerReply() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.preferences.load()

    await store.updatePreferences(.soundsEnabled(false))

    XCTAssertEqual(store.preferences.value?.soundsEnabled, false)
    let updates = await api.updates
    XCTAssertEqual(updates, [.soundsEnabled(false)])
    XCTAssertFalse(store.saveFailed)
  }

  func testRefusedPreferenceGoesBackAndSaysSo() async {
    let api = SettingsAPIStub(updateError: APIError.unavailable)
    let store = makeStore(api: api)
    await store.preferences.load()

    await store.updatePreferences(.dailyLimitMinutes(30))

    XCTAssertNil(store.preferences.value?.dailyLimitMinutes)
    XCTAssertTrue(store.saveFailed)
  }

  func testAFailedSaveLeavesAnotherSettingSavedAfterIt() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.preferences.load()
    await api.hold(.soundsEnabled(false))

    let sounds = Task { await store.updatePreferences(.soundsEnabled(false)) }
    await api.waitForHeldUpdate()
    let limit = Task { await store.updatePreferences(.dailyLimitMinutes(30)) }
    await waitUntil { store.preferences.value?.dailyLimitMinutes == 30 }
    await api.releaseHeldUpdate(throwing: APIError.unavailable)
    await sounds.value
    await limit.value

    XCTAssertEqual(store.preferences.value?.dailyLimitMinutes, 30, "the later save stays")
    XCTAssertEqual(store.preferences.value?.soundsEnabled, true)
    XCTAssertTrue(store.saveFailed)
  }

  func testAFailedSaveLeavesALaterChangeOfTheSameSetting() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.preferences.load()
    await api.hold(.dailyLimitMinutes(30))

    let first = Task { await store.updatePreferences(.dailyLimitMinutes(30)) }
    await api.waitForHeldUpdate()
    let second = Task { await store.updatePreferences(.dailyLimitMinutes(60)) }
    await waitUntil { store.preferences.value?.dailyLimitMinutes == 60 }
    await api.releaseHeldUpdate(throwing: APIError.unavailable)
    await first.value
    await second.value

    XCTAssertEqual(store.preferences.value?.dailyLimitMinutes, 60)
    let updates = await api.updates
    XCTAssertEqual(updates, [.dailyLimitMinutes(30), .dailyLimitMinutes(60)], "sent in order")
  }

  func testTwoFailedSavesShowWhatTheServerHas() async {
    let api = SettingsAPIStub(updateError: APIError.unavailable)
    let store = makeStore(api: api)
    await store.preferences.load()
    await api.hold(.dailyLimitMinutes(30))

    let first = Task { await store.updatePreferences(.dailyLimitMinutes(30)) }
    await api.waitForHeldUpdate()
    let second = Task { await store.updatePreferences(.dailyLimitMinutes(60)) }
    await waitUntil { store.preferences.value?.dailyLimitMinutes == 60 }
    await api.releaseHeldUpdate(throwing: APIError.unavailable)
    await first.value
    await second.value

    XCTAssertNil(store.preferences.value?.dailyLimitMinutes, "neither limit saved")
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

  func testAChangeWaitingWhenItsLearnerLeavesIsNeverSentForTheNext() async {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner-a")
    let cache = AppCache(session: session)
    let api = SettingsAPIStub()
    let store = SettingsStore(api: api, cache: cache)
    await store.preferences.load()
    await api.hold(.soundsEnabled(false))

    let sounds = Task { await store.updatePreferences(.soundsEnabled(false)) }
    await api.waitForHeldUpdate()
    let limit = Task { await store.updatePreferences(.dailyLimitMinutes(30)) }
    await waitUntil { store.preferences.value?.dailyLimitMinutes == 30 }
    await accounts.signIn(session, as: "learner-b")
    cache.followSession()
    await api.releaseHeldUpdate(throwing: APIError.network)
    await sounds.value
    await limit.value

    let updates = await api.updates
    XCTAssertEqual(updates, [.soundsEnabled(false)], "learner A's limit never reaches learner B")
  }

  func testAnUndoAnsweredAfterAnotherDeletionLeavesThatOneUndoable() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.memory.load()
    await store.deleteMemoryFact(id: MemoryFact.evenings.id)
    await api.holdDeletes()

    let deletion = Task { await store.deleteMemoryFact(id: MemoryFact.sciFi.id) }
    await api.waitForHeldDelete()
    let undo = Task { await store.undoDeletion() }
    // Lets the undo take the notice it's for before the deletion's answer replaces it.
    for _ in 0..<10 {
      await Task.yield()
    }
    await api.releaseDeletes(throwing: nil)
    await deletion.value
    await undo.value

    XCTAssertEqual(store.deletedFact, .sciFi)
    XCTAssertEqual(store.undoStatus, .idle, "the later deletion can still be undone")
  }

  func testDeletedFactLeavesTheListAndCanComeBack() async {
    let api = SettingsAPIStub()
    let store = makeStore(api: api)
    await store.memory.load()

    await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    XCTAssertEqual(store.memory.value?.facts, [.sciFi])
    XCTAssertEqual(store.deletedFact, .evenings)

    await store.undoDeletion()

    XCTAssertEqual(store.memory.value?.facts, [.sciFi, .evenings])
    XCTAssertEqual(store.undoStatus, .undone)
    let restoredFactIds = await api.restoredFactIds
    XCTAssertEqual(restoredFactIds, [MemoryFact.evenings.id])
  }

  func testFailedDeletionKeepsTheFact() async {
    let store = makeStore(api: SettingsAPIStub(deleteError: APIError.network))
    await store.memory.load()

    await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    XCTAssertEqual(store.memory.value?.facts, [.sciFi, .evenings])
    XCTAssertNil(store.deletedFact)
    XCTAssertTrue(store.saveFailed)
  }

  func testUndoThatChangedSinceSaysItCouldNot() async {
    let store = makeStore(api: SettingsAPIStub(restoreError: APIError.unavailable))
    await store.memory.load()
    await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    await store.undoDeletion()

    XCTAssertEqual(store.undoStatus, .failed)
    XCTAssertFalse(store.saveFailed)
    XCTAssertEqual(store.memory.value?.facts, [.sciFi])
  }

  func testExpiredSessionSignsOutWithoutSayingTheSaveFailed() async {
    let session = SessionStore.preview(account: .settingsTestFixture)
    let store = SettingsStore(
      api: SettingsAPIStub(updateError: APIError.unauthorized), cache: AppCache(session: session))
    await store.preferences.load()

    await store.updatePreferences(.soundsEnabled(false))

    XCTAssertNil(session.account)
    XCTAssertFalse(store.saveFailed)
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

    await store.deleteMemoryFact(id: MemoryFact.evenings.id)

    XCTAssertNil(store.deletedFact)
    XCTAssertFalse(store.saveFailed)
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
    await deletion.value

    XCTAssertEqual(learnerBFacts, [.learnerB])
    XCTAssertEqual(store.memory.value?.facts, [.learnerB], "A's facts never come back as B's")
    XCTAssertNil(store.deletedFact)
    XCTAssertFalse(store.saveFailed)
  }

  func testTheDeletedFactNoticeStaysWithItsLearner() async {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner-a")
    let cache = AppCache(session: session)
    let store = SettingsStore(api: SettingsAPIStub(), cache: cache)
    await store.memory.load()
    await store.deleteMemoryFact(id: MemoryFact.evenings.id)
    XCTAssertEqual(store.deletedFact, .evenings)

    await accounts.signIn(session, as: "learner-b")

    XCTAssertNil(store.deletedFact)
    XCTAssertEqual(store.undoStatus, .idle)
  }

  func testExportFailureDoesNotSayASettingDidNotSave() async {
    let store = makeStore(api: SettingsAPIStub(exportError: APIError.network))

    let data = await store.exportAccountData()

    XCTAssertNil(data)
    XCTAssertFalse(store.saveFailed)
  }

  private func waitUntil(_ condition: () -> Bool) async {
    for _ in 0..<10_000 where !condition() {
      await Task.yield()
    }

    XCTAssertTrue(condition(), "the change never showed")
  }

  private func makeStore(api: SettingsAPIStub) -> SettingsStore {
    SettingsStore(
      api: api, cache: AppCache(session: SessionStore.preview(account: .settingsTestFixture)))
  }
}

private actor SettingsAPIStub: SettingsAPIClient {
  private(set) var updates: [PreferencesUpdate] = []
  private(set) var restoredFactIds: [String] = []
  private var beforeDelete: (@MainActor @Sendable () async -> Void)?
  private var holdsDeletes = false
  private var heldDelete: CheckedContinuation<Void, Error>?
  private var heldUpdate: PreferencesUpdate?
  private var heldUpdateResponse: CheckedContinuation<Void, Error>?
  private var holdsEdits = false
  private var heldEdit: CheckedContinuation<Void, Error>?

  private let updateError: Error?
  private let deleteError: Error?
  private let restoreError: Error?
  private let exportError: Error?

  func runBeforeDelete(_ action: @escaping @MainActor @Sendable () async -> Void) {
    beforeDelete = action
  }

  init(
    updateError: Error? = nil,
    deleteError: Error? = nil,
    restoreError: Error? = nil,
    exportError: Error? = nil
  ) {
    self.updateError = updateError
    self.deleteError = deleteError
    self.restoreError = restoreError
    self.exportError = exportError
  }

  nonisolated func getPreferences(token: String) async throws -> LearningPreferences {
    .settingsTestFixture
  }

  func updatePreferences(token: String, _ update: PreferencesUpdate) async throws
    -> LearningPreferences
  {
    updates.append(update)

    if update == heldUpdate {
      heldUpdate = nil
      try await withCheckedThrowingContinuation { heldUpdateResponse = $0 }
    }

    if let updateError {
      throw updateError
    }

    return update.applied(to: .settingsTestFixture)
  }

  func hold(_ update: PreferencesUpdate) {
    heldUpdate = update
  }

  func waitForHeldUpdate() async {
    while heldUpdateResponse == nil {
      await Task.yield()
    }
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
      try await withCheckedThrowingContinuation { heldEdit = $0 }
    }

    return .evenings
  }

  func holdEdits() {
    holdsEdits = true
  }

  func waitForHeldEdit() async {
    while heldEdit == nil {
      await Task.yield()
    }
  }

  func releaseEdits(throwing error: Error) {
    heldEdit?.resume(throwing: error)
    heldEdit = nil
  }

  func deleteMemoryFact(token: String, factId: String) async throws -> MemoryFact {
    await beforeDelete?()

    if holdsDeletes {
      try await withCheckedThrowingContinuation { heldDelete = $0 }
    }

    if let deleteError {
      throw deleteError
    }

    return [MemoryFact.sciFi, .evenings].first { $0.id == factId } ?? .evenings
  }

  func holdDeletes() {
    holdsDeletes = true
  }

  func waitForHeldDelete() async {
    while heldDelete == nil {
      await Task.yield()
    }
  }

  func releaseDeletes(throwing error: Error?) {
    if let error {
      heldDelete?.resume(throwing: error)
    } else {
      heldDelete?.resume()
    }

    heldDelete = nil
  }

  func restoreMemoryFact(token: String, factId: String) async throws -> [MemoryFact] {
    if let restoreError {
      throw restoreError
    }

    restoredFactIds.append(factId)
    return [.evenings]
  }

  nonisolated func getAllowance(token: String) async throws -> PlanAllowance {
    PlanAllowance(tier: .free, buddyMessagesToday: 1, buddyMessagesDailyLimit: 5)
  }

  nonisolated func exportMemory(token: String) async throws -> Data { Data() }

  func exportAccountData(token: String) async throws -> Data {
    if let exportError {
      throw exportError
    }

    return Data()
  }
}

extension LearningPreferences {
  fileprivate static let settingsTestFixture = LearningPreferences(
    buddy: BuddyChoice(kind: .otto, name: nil, glasses: .round),
    buddyPicked: true,
    availableGlasses: [.round],
    dailyLimitMinutes: nil,
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
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "settings-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

private final class SwitchingAccountAPI: AccountAPIClient, @unchecked Sendable {
  /// Only the main actor changes it, between requests.
  nonisolated(unsafe) private var userID = "learner-a"

  @MainActor
  func signedIn(as userID: String) async -> SessionStore {
    let session = SessionStore(
      api: self, credentialStore: InMemorySessionCredentialStore(token: nil),
      googleAuthentication: GoogleAuthenticationClient(), skipsCredentialReconciliation: true)
    await signIn(session, as: userID)
    return session
  }

  @MainActor
  func signIn(_ session: SessionStore, as userID: String) async {
    self.userID = userID
    await session.signInWithEmailCode(email: "\(userID)@zoonk.test", code: "123456")
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
      user: AccountUser(
        displayUsername: userID, email: "\(userID)@zoonk.test", id: userID, image: nil,
        name: userID, username: userID))
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws
    -> String
  {
    "token-\(userID)"
  }

  func deleteAccount(
    token: String, appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) async throws -> AccountDeletionResponse { throw APIError.unavailable }
  func sendEmailCode(email: String, token: String?) async throws {}
  func signInWithApple(_ credentials: AppleSignInCredentials, guestToken: String?) async throws
    -> String
  {
    throw APIError.unavailable
  }
  func signInAsGuest() async throws -> String { throw APIError.unavailable }
  func signInWithGoogle(idToken: String, guestToken: String?) async throws -> String {
    throw APIError.unavailable
  }
  func signOut(token: String) async throws {}
  func synchronizeAppleSubscription(token: String, signedTransaction: String) async throws
    -> AppleSubscriptionSynchronization
  { throw APIError.unavailable }
  func updateProfile(token: String, name: String, username: String) async throws
    -> CurrentAccount
  { throw APIError.unavailable }
}
