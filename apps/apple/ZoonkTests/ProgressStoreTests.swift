import XCTest

@testable import Zoonk

@MainActor
final class ProgressStoreTests: XCTestCase {
  func testOverviewPublishesLoadedProgress() async {
    let overview = ProgressOverview.testFixture
    let store = makeStore(overviewResults: [.success(overview)])

    await store.overview.load()

    XCTAssertEqual(store.overview.state, .loaded(overview))
  }

  func testEmptyOverviewPublishesEmptyState() async {
    let store = makeStore(overviewResults: [.success(.emptyTestFixture)])

    await store.overview.load()

    XCTAssertEqual(store.overview.state, .empty)
  }

  func testOverviewWithLearningTimePublishesLoadedState() async {
    let overview = ProgressOverview.learningTimeTestFixture
    let store = makeStore(overviewResults: [.success(overview)])

    await store.overview.load()

    XCTAssertEqual(store.overview.state, .loaded(overview))
  }

  func testActivityWithLearningTimePublishesLoadedState() async {
    let activity = ActivityProgress(
      days: [],
      summary: .learningTimeTestFixture)
    let session = SessionStore.preview(account: .progressTestFixture)
    let store = ProgressStore(
      api: ProgressAPIStub(activityResult: .success(activity)),
      cache: AppCache(session: session))

    await store.activity.load()

    XCTAssertEqual(store.activity.state, .loaded(activity))
  }

  func testMissingEnergyPublishesEmptyState() async {
    let session = SessionStore.preview(account: .progressTestFixture)
    let store = ProgressStore(
      api: ProgressAPIStub(energyResult: .success(nil)),
      cache: AppCache(session: session))

    await store.energy.load()

    XCTAssertEqual(store.energy.state, .empty)
  }

  func testUnauthorizedOverviewExpiresTheMatchingSession() async {
    let session = SessionStore.preview(account: .progressTestFixture)
    let store = ProgressStore(
      api: ProgressAPIStub(overviewResults: [.failure(APIError.unauthorized)]),
      cache: AppCache(session: session))

    await store.overview.load()

    XCTAssertNil(session.account)
    XCTAssertEqual(store.overview.state, .idle)
  }

  func testOverviewCanRetryAfterNetworkFailure() async {
    let overview = ProgressOverview.testFixture
    let store = makeStore(
      overviewResults: [
        .failure(APIError.network),
        .success(overview),
      ])

    await store.overview.load()
    XCTAssertEqual(store.overview.state, .failed(.network))

    await store.overview.refresh()
    XCTAssertEqual(store.overview.state, .loaded(overview))
  }

  func testOverviewIsReusedUntilProgressChanges() async {
    let initialOverview = ProgressOverview.testFixture
    let refreshedOverview = ProgressOverview.learningTimeTestFixture
    let session = SessionStore.preview(account: .progressTestFixture)
    let cache = AppCache(session: session)
    let store = ProgressStore(
      api: ProgressAPIStub(
        overviewResults: [.success(initialOverview), .success(refreshedOverview)]),
      cache: cache)

    await store.overview.load()
    await store.overview.load()
    XCTAssertEqual(store.overview.state, .loaded(initialOverview))

    cache.invalidate([.userProgress])
    await store.overview.load()
    XCTAssertEqual(store.overview.state, .loaded(refreshedOverview))
  }

  func testSameAccountCredentialReplacementStartsANewOverviewRequest() async {
    let credentialStore = RotatingProgressCredentialStore(token: "old-session")
    let session = SessionStore(
      api: ProgressAccountAPIStub(account: .progressTestFixture),
      credentialStore: credentialStore,
      googleAuthentication: GoogleAuthenticationClient())
    await session.restore()

    let firstRequestStarted = expectation(description: "Old credential request started")
    let secondRequestStarted = expectation(description: "New credential request started")
    let api = SuspendedOverviewAPIStub { requestCount in
      if requestCount == 1 {
        firstRequestStarted.fulfill()
      } else if requestCount == 2 {
        secondRequestStarted.fulfill()
      }
    }
    let store = ProgressStore(api: api, cache: AppCache(session: session))
    let firstRequest = Task { await store.overview.load() }
    await fulfillment(of: [firstRequestStarted], timeout: 1)

    credentialStore.token = "new-session"
    await session.reconcileSynchronizedCredential()

    let secondRequest = Task { await store.overview.load() }
    await fulfillment(of: [secondRequestStarted], timeout: 1)

    await api.resolveRequest(at: 1, with: .testFixture)
    await secondRequest.value
    await api.resolveRequest(at: 0, with: .emptyTestFixture)
    await firstRequest.value

    let requestTokens = await api.requestTokens
    XCTAssertEqual(requestTokens, ["old-session", "new-session"])
    XCTAssertEqual(store.overview.state, .loaded(.testFixture))
  }

  private func makeStore(overviewResults: [Result<ProgressOverview, Error>]) -> ProgressStore {
    ProgressStore(
      api: ProgressAPIStub(overviewResults: overviewResults),
      cache: AppCache(session: .preview(account: .progressTestFixture)))
  }
}

private actor SuspendedOverviewAPIStub: ProgressAPIClient {
  private struct Request {
    let continuation: CheckedContinuation<ProgressOverview, any Error>
    let id: UUID
  }

  private let requestDidStart: @Sendable (Int) -> Void
  private var overviewRequests: [Request?] = []
  private(set) var requestTokens: [String] = []

  init(requestDidStart: @escaping @Sendable (Int) -> Void = { _ in }) {
    self.requestDidStart = requestDidStart
  }

  var requestCount: Int { overviewRequests.count }

  func resolveRequest(at index: Int, with overview: ProgressOverview) {
    overviewRequests[index]?.continuation.resume(returning: overview)
    overviewRequests[index] = nil
  }

  func cancelAllRequests() {
    for request in overviewRequests.compactMap(\.self) {
      request.continuation.resume(throwing: CancellationError())
    }

    overviewRequests = overviewRequests.map { _ in nil }
  }

  func getOverview(token: String) async throws -> ProgressOverview {
    let requestID = UUID()

    return try await withTaskCancellationHandler {
      try Task.checkCancellation()

      return try await withCheckedThrowingContinuation { continuation in
        guard !Task.isCancelled else {
          continuation.resume(throwing: CancellationError())
          return
        }

        requestTokens.append(token)
        overviewRequests.append(Request(continuation: continuation, id: requestID))
        requestDidStart(overviewRequests.count)
      }
    } onCancel: {
      Task {
        await self.cancelRequest(id: requestID)
      }
    }
  }

  private func cancelRequest(id: UUID) {
    guard let index = overviewRequests.firstIndex(where: { $0?.id == id }) else {
      return
    }

    overviewRequests[index]?.continuation.resume(throwing: CancellationError())
    overviewRequests[index] = nil
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    throw APIError.unavailable
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
  private let activityResult: Result<ActivityProgress, Error>
  private let energyResult: Result<EnergyProgress?, Error>
  private var overviewResults: [Result<ProgressOverview, Error>]

  init(overviewResults: [Result<ProgressOverview, Error>]) {
    activityResult = .failure(APIError.unavailable)
    energyResult = .failure(APIError.unavailable)
    self.overviewResults = overviewResults
  }

  init(activityResult: Result<ActivityProgress, Error>) {
    self.activityResult = activityResult
    energyResult = .failure(APIError.unavailable)
    overviewResults = []
  }

  init(energyResult: Result<EnergyProgress?, Error>) {
    activityResult = .failure(APIError.unavailable)
    self.energyResult = energyResult
    overviewResults = []
  }

  func getOverview(token: String) async throws -> ProgressOverview {
    guard !overviewResults.isEmpty else {
      throw APIError.unavailable
    }

    return try overviewResults.removeFirst().get()
  }

  func getActivity(token: String) async throws -> ActivityProgress {
    try activityResult.get()
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

  func signInWithApple(_ credentials: AppleSignInCredentials) async throws -> String {
    throw AccountAPIError.invalidResponse
  }

  func signInWithEmailCode(email: String, code: String) async throws -> String {
    throw AccountAPIError.invalidResponse
  }

  func signInWithGoogle(idToken: String) async throws -> String {
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

extension ProgressOverview {
  fileprivate static let emptyTestFixture = ProgressOverview(
    activity: ActivitySummary(
      learningDays: 0,
      totalLearningSeconds: 0,
      totalLessonCompletions: 0),
    energy: nil,
    level: nil,
    score: nil,
    strongestDaypart: nil,
    strongestWeekday: nil)

  fileprivate static let testFixture = ProgressOverview(
    activity: ActivitySummary(
      learningDays: 12,
      totalLearningSeconds: 7_200,
      totalLessonCompletions: 24),
    energy: 82,
    level: LevelProgress(
      belt: .green,
      bpPerLevel: 1_000,
      bpToNextLevel: 240,
      isMaxLevel: false,
      level: 4,
      progressInLevel: 760,
      totalBrainPower: 3_760),
    score: ScorePerformance(
      correctAnswers: 41,
      incorrectAnswers: 9,
      score: 82,
      totalAnswers: 50),
    strongestDaypart: DaypartScorePattern(
      daypart: .morning,
      performance: ScorePerformance(
        correctAnswers: 20,
        incorrectAnswers: 2,
        score: 90.9,
        totalAnswers: 22)),
    strongestWeekday: WeekdayScorePattern(
      performance: ScorePerformance(
        correctAnswers: 14,
        incorrectAnswers: 1,
        score: 93.3,
        totalAnswers: 15),
      weekday: .tuesday))

  fileprivate static let learningTimeTestFixture = ProgressOverview(
    activity: .learningTimeTestFixture,
    energy: nil,
    level: nil,
    score: nil,
    strongestDaypart: nil,
    strongestWeekday: nil)
}

extension ActivitySummary {
  fileprivate static let learningTimeTestFixture = ActivitySummary(
    learningDays: 1,
    totalLearningSeconds: 120,
    totalLessonCompletions: 0)
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
