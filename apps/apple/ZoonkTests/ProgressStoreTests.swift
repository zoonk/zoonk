import XCTest

@testable import Zoonk

@MainActor
final class ProgressStoreTests: XCTestCase {
  func testActivityPublishesLoadedProgress() async {
    let store = makeStore(activityResults: [.success(.testFixture)])

    await store.activity.load()

    XCTAssertEqual(store.activity.state, .loaded(.testFixture))
  }

  func testActivityWithoutStudyDaysStaysLoaded() async {
    let store = makeStore(activityResults: [.success(.emptyTestFixture)])

    await store.activity.load()

    XCTAssertEqual(store.activity.state, .loaded(.emptyTestFixture))
  }

  func testMissingEnergyPublishesEmptyState() async {
    let session = SessionStore.preview(account: .progressTestFixture)
    let store = ProgressStore(
      api: ProgressAPIStub(energyResult: .success(nil)),
      cache: AppCache(session: session))

    await store.energy.load()

    XCTAssertEqual(store.energy.state, .empty)
  }

  func testUnauthorizedActivityExpiresTheMatchingSession() async {
    let session = SessionStore.preview(account: .progressTestFixture)
    let store = ProgressStore(
      api: ProgressAPIStub(activityResults: [.failure(APIError.unauthorized)]),
      cache: AppCache(session: session))

    await store.activity.load()

    XCTAssertNil(session.account)
    XCTAssertEqual(store.activity.state, .idle)
  }

  func testActivityCanRetryAfterNetworkFailure() async {
    let store = makeStore(activityResults: [.failure(APIError.network), .success(.testFixture)])

    await store.activity.load()
    XCTAssertEqual(store.activity.state, .failed(.network))

    await store.activity.refresh()
    XCTAssertEqual(store.activity.state, .loaded(.testFixture))
  }

  func testActivityIsReusedUntilProgressChanges() async {
    let session = SessionStore.preview(account: .progressTestFixture)
    let cache = AppCache(session: session)
    let store = ProgressStore(
      api: ProgressAPIStub(activityResults: [.success(.emptyTestFixture), .success(.testFixture)]),
      cache: cache)

    await store.activity.load()
    await store.activity.load()
    XCTAssertEqual(store.activity.state, .loaded(.emptyTestFixture))

    cache.invalidate([.userProgress])
    await store.activity.load()
    XCTAssertEqual(store.activity.state, .loaded(.testFixture))
  }

  func testSameAccountCredentialReplacementStartsANewActivityRequest() async {
    let credentialStore = RotatingProgressCredentialStore(token: "old-session")
    let session = SessionStore(
      api: ProgressAccountAPIStub(account: .progressTestFixture),
      credentialStore: credentialStore,
      googleAuthentication: GoogleAuthenticationClient())
    await session.restore()

    let firstRequestStarted = expectation(description: "Old credential request started")
    let secondRequestStarted = expectation(description: "New credential request started")
    let api = SuspendedActivityAPIStub { requestCount in
      if requestCount == 1 {
        firstRequestStarted.fulfill()
      } else if requestCount == 2 {
        secondRequestStarted.fulfill()
      }
    }
    let store = ProgressStore(api: api, cache: AppCache(session: session))
    let firstRequest = Task { await store.activity.load() }
    await fulfillment(of: [firstRequestStarted], timeout: 1)

    credentialStore.token = "new-session"
    await session.reconcileSynchronizedCredential()

    let secondRequest = Task { await store.activity.load() }
    await fulfillment(of: [secondRequestStarted], timeout: 1)

    await api.resolveRequest(at: 1, with: .testFixture)
    await secondRequest.value
    await api.resolveRequest(at: 0, with: .emptyTestFixture)
    await firstRequest.value

    let requestTokens = await api.requestTokens
    XCTAssertEqual(requestTokens, ["old-session", "new-session"])
    XCTAssertEqual(store.activity.state, .loaded(.testFixture))
  }

  private func makeStore(activityResults: [Result<ActivityProgress, Error>]) -> ProgressStore {
    ProgressStore(
      api: ProgressAPIStub(activityResults: activityResults),
      cache: AppCache(session: .preview(account: .progressTestFixture)))
  }
}

private actor SuspendedActivityAPIStub: ProgressAPIClient {
  private struct Request {
    let continuation: CheckedContinuation<ActivityProgress, any Error>
    let id: UUID
  }

  private let requestDidStart: @Sendable (Int) -> Void
  private var activityRequests: [Request?] = []
  private(set) var requestTokens: [String] = []

  init(requestDidStart: @escaping @Sendable (Int) -> Void = { _ in }) {
    self.requestDidStart = requestDidStart
  }

  func resolveRequest(at index: Int, with activity: ActivityProgress) {
    activityRequests[index]?.continuation.resume(returning: activity)
    activityRequests[index] = nil
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    let requestID = UUID()

    return try await withTaskCancellationHandler {
      try Task.checkCancellation()

      return try await withCheckedThrowingContinuation { continuation in
        guard !Task.isCancelled else {
          continuation.resume(throwing: CancellationError())
          return
        }

        requestTokens.append(token)
        activityRequests.append(Request(continuation: continuation, id: requestID))
        requestDidStart(activityRequests.count)
      }
    } onCancel: {
      Task {
        await self.cancelRequest(id: requestID)
      }
    }
  }

  private func cancelRequest(id: UUID) {
    guard let index = activityRequests.firstIndex(where: { $0?.id == id }) else {
      return
    }

    activityRequests[index]?.continuation.resume(throwing: CancellationError())
    activityRequests[index] = nil
  }

  func getEnergy(token: String) async throws -> EnergyProgress? {
    throw APIError.unavailable
  }

  func getLevel(token: String) async throws -> LevelProgress? {
    throw APIError.unavailable
  }

  func getScore(token: String) async throws -> ScoreProgress? {
    throw APIError.unavailable
  }

  func getScorePatterns(token: String) async throws -> ScorePatterns? {
    throw APIError.unavailable
  }
}

private actor ProgressAPIStub: ProgressAPIClient {
  private var activityResults: [Result<ActivityProgress, Error>]
  private let energyResult: Result<EnergyProgress?, Error>

  init(activityResults: [Result<ActivityProgress, Error>]) {
    self.activityResults = activityResults
    energyResult = .failure(APIError.unavailable)
  }

  init(energyResult: Result<EnergyProgress?, Error>) {
    activityResults = []
    self.energyResult = energyResult
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    guard !activityResults.isEmpty else {
      throw APIError.unavailable
    }

    return try activityResults.removeFirst().get()
  }

  func getEnergy(token: String) async throws -> EnergyProgress? {
    try energyResult.get()
  }

  func getLevel(token: String) async throws -> LevelProgress? {
    throw APIError.unavailable
  }

  func getScore(token: String) async throws -> ScoreProgress? {
    throw APIError.unavailable
  }

  func getScorePatterns(token: String) async throws -> ScorePatterns? {
    throw APIError.unavailable
  }
}

private final class RotatingProgressCredentialStore: SessionCredentialStoring {
  var token: String?

  init(token: String?) {
    self.token = token
  }

  func delete() throws {
    token = nil
  }

  func read() throws -> String? {
    token
  }

  func save(_ token: String) throws {
    self.token = token
  }
}

private final class ProgressAccountAPIStub: AccountAPIClient, @unchecked Sendable {
  let account: CurrentAccount

  init(account: CurrentAccount) {
    self.account = account
  }

  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) async throws -> AccountDeletionResponse {
    throw AccountAPIError.invalidResponse
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    account
  }

  func sendEmailCode(email: String, token: String?) async throws {
    throw AccountAPIError.invalidResponse
  }

  func signInWithApple(_ credentials: AppleSignInCredentials, guestToken: String?) async throws
    -> String
  {
    throw AccountAPIError.invalidResponse
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws
    -> String
  {
    throw AccountAPIError.invalidResponse
  }

  func signInWithGoogle(idToken: String, guestToken: String?) async throws -> String {
    throw AccountAPIError.invalidResponse
  }

  func signOut(token: String) async throws {
    throw AccountAPIError.invalidResponse
  }

  func synchronizeAppleSubscription(
    token: String,
    signedTransaction: String
  ) async throws -> AppleSubscriptionSynchronization {
    throw AccountAPIError.invalidResponse
  }

  func updateProfile(token: String, name: String, username: String) async throws
    -> CurrentAccount
  {
    throw AccountAPIError.invalidResponse
  }
}

extension ActivityProgress {
  fileprivate static let emptyTestFixture = ActivityProgress(
    days: [],
    summary: ActivitySummary(learningDays: 0, totalLearningSeconds: 0, totalLessonCompletions: 0))

  fileprivate static let testFixture = ActivityProgress(
    days: [ActivityProgressDay(activitiesCompleted: 3, date: ProgressDate("2026-08-20")!)],
    summary: ActivitySummary(
      learningDays: 12, totalLearningSeconds: 7_200, totalLessonCompletions: 24))
}

extension CurrentAccount {
  fileprivate static let progressTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "progress-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
