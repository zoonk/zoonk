import XCTest

@testable import Zoonk

@MainActor
final class LearningProfileStoreTests: XCTestCase {
  func testSuggestedInterestsRecognizeExistingCaseAndPreserveCustomEntries() async {
    let api = LearningProfileStub()
    let session = makeSession()
    let store = LearningProfileStore(api: api)
    await store.load(session: session)
    store.text = "science fiction\nFootball\nNative plants"
    XCTAssertTrue(store.includes(.scienceFiction))
    XCTAssertEqual(store.customInterestsText, "Football\nNative plants")
    store.set(.scienceFiction, selected: true)
    XCTAssertEqual(store.text, "science fiction\nFootball\nNative plants")
    store.set(.technology, selected: true)
    store.customInterestsText = " Football \n\n Board games \n"
    let saved = await store.save(session: session)
    XCTAssertTrue(saved)
    let updates = await api.updates
    XCTAssertEqual(updates, [["science fiction", "Technology", "Football", "Board games"]])
  }

  func testRemovingSuggestedInterestLeavesCustomTopicsIntact() async {
    let store = LearningProfileStore(api: LearningProfileStub())
    let session = makeSession()
    await store.load(session: session)
    store.text = "Science fiction\nSCIENCE FICTION\nScience fiction films\nPhotography"
    store.set(.scienceFiction, selected: false)
    XCTAssertEqual(store.text, "Photography\nScience fiction films")
    XCTAssertFalse(store.includes(.scienceFiction))
    XCTAssertTrue(store.includes(.photography))
    XCTAssertEqual(store.customInterestsText, "Science fiction films")
  }

  func testEditingCustomInterestsPreservesNewlinesAndDoesNotSelectPartialSuggestions() {
    let store = LearningProfileStore(api: LearningProfileStub())
    store.customInterestsText = "Music"
    store.customInterestsText = "Music festivals\n"
    XCTAssertFalse(store.includes(.music))
    XCTAssertEqual(store.customInterestsText, "Music festivals\n")
    store.set(.science, selected: true)
    XCTAssertEqual(store.customInterestsText, "Music festivals\n")
  }

  func testLoadsAndSavesOneInterestPerLineWithTheCurrentCredential() async {
    let api = LearningProfileStub()
    let session = makeSession()
    let store = LearningProfileStore(api: api)
    await store.load(session: session)
    XCTAssertEqual(store.text, "Science fiction")
    store.text = " Photography \n\n Science fiction \n"
    let saved = await store.save(session: session)
    XCTAssertTrue(saved)
    XCTAssertEqual(store.text, "Photography\nScience fiction")
    let updates = await api.updates
    XCTAssertEqual(updates, [["Photography", "Science fiction"]])
    let tokens = await api.tokens
    XCTAssertEqual(tokens, ["preview-session", "preview-session"])
  }

  func testTransientSaveFailurePreservesTheDraftAndCanRetry() async {
    let api = LearningProfileStub(saveFailures: [.unavailable])
    let session = makeSession()
    let store = LearningProfileStore(api: api)
    await store.load(session: session)
    store.text = "Photography"
    let failed = await store.save(session: session)
    XCTAssertFalse(failed)
    XCTAssertEqual(store.failure, .unavailable)
    XCTAssertEqual(store.text, "Photography")
    XCTAssertFalse(store.isWorking)
    let saved = await store.save(session: session)
    XCTAssertTrue(saved)
    XCTAssertNil(store.failure)
  }

  func testUnauthorizedSaveExpiresOnlyTheCurrentSessionAndClearsItsDraft() async {
    let session = makeSession()
    let store = LearningProfileStore(api: LearningProfileStub(saveFailures: [.unauthorized]))
    await store.load(session: session)
    store.text = "Private interest"
    let saved = await store.save(session: session)
    XCTAssertFalse(saved)
    XCTAssertNil(session.authenticatedSession)
    await store.load(session: session)
    XCTAssertEqual(store.text, "")
    XCTAssertFalse(store.isLoaded)
  }

  func testOldLoadCannotReplaceTheNextAccountsInterests() async {
    let started = expectation(description: "Old account request began")
    let api = SuspendedLearningProfileStub(requestDidStart: started.fulfill)
    let store = LearningProfileStore(api: api)
    let first = makeSession(id: "first")
    let second = makeSession(id: "second")
    let request = Task { await store.load(session: first) }
    await fulfillment(of: [started], timeout: 1)
    await store.load(session: second)
    XCTAssertEqual(store.text, "New account interest")
    await api.resolve()
    await request.value
    XCTAssertEqual(store.text, "New account interest")
    XCTAssertFalse(store.isWorking)
  }

  func testTransientInitialLoadCanRetryWithoutBecomingEditableBeforeLoading() async {
    let api = LearningProfileStub(loadFailures: [.unavailable])
    let store = LearningProfileStore(api: api)
    let session = makeSession()
    await store.load(session: session)
    XCTAssertFalse(store.isLoaded)
    XCTAssertEqual(store.failure, .unavailable)
    await store.load(session: session, force: true)
    XCTAssertTrue(store.isLoaded)
    XCTAssertNil(store.failure)
  }

  private func makeSession(id: String = "learner") -> SessionStore {
    .preview(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
        user: AccountUser(
          displayUsername: id, email: "\(id)@zoonk.test", id: id, image: nil, name: "Learner",
          username: id)))
  }
}

private actor LearningProfileStub: LearningProfileAPIClient {
  private var loadFailures: [LearningProfileFailure]
  private var saveFailures: [LearningProfileFailure]
  private(set) var updates: [[String]] = []
  private(set) var tokens: [String] = []

  init(loadFailures: [LearningProfileFailure] = [], saveFailures: [LearningProfileFailure] = []) {
    self.loadFailures = loadFailures
    self.saveFailures = saveFailures
  }

  func getInterests(token: String) async throws -> [String] {
    tokens.append(token)
    if !loadFailures.isEmpty { throw loadFailures.removeFirst() }
    return ["Science fiction"]
  }

  func updateInterests(_ interests: [String], token: String) async throws -> [String] {
    updates.append(interests)
    tokens.append(token)
    if !saveFailures.isEmpty { throw saveFailures.removeFirst() }
    return interests
  }
}

private actor SuspendedLearningProfileStub: LearningProfileAPIClient {
  let requestDidStart: @Sendable () -> Void
  private var continuation: CheckedContinuation<[String], Never>?
  private var callCount = 0

  init(requestDidStart: @escaping @Sendable () -> Void) { self.requestDidStart = requestDidStart }

  func getInterests(token: String) async throws -> [String] {
    callCount += 1
    guard callCount == 1 else { return ["New account interest"] }
    return await withCheckedContinuation { continuation in
      self.continuation = continuation
      requestDidStart()
    }
  }

  func resolve() {
    continuation?.resume(returning: ["Old private interest"])
    continuation = nil
  }
  func updateInterests(_ interests: [String], token: String) async throws -> [String] { interests }
}
