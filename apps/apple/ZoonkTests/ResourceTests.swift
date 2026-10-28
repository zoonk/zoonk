import Observation
import XCTest

@testable import Zoonk

@MainActor
final class ResourceTests: XCTestCase {
  func testFirstLoadShowsTheValue() async {
    let requests = Requests(results: [.success(1)])
    let resource = makeResource(requests: requests)

    XCTAssertEqual(resource.state, .idle)
    await resource.load()

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 1)
  }

  func testNoValueOrAnEmptyValueIsEmpty() async {
    let missing = makeResource(requests: Requests(results: [.success(nil)]))
    let empty = makeResource(requests: Requests(results: [.success(0)]), isEmpty: { $0 == 0 })

    await missing.load()
    await empty.load()

    XCTAssertEqual(missing.state, .empty)
    XCTAssertEqual(empty.state, .empty)
  }

  func testAFreshValueIsReusedWithoutARequest() async {
    let requests = Requests(results: [.success(1), .success(2)])
    let resource = makeResource(requests: requests)

    await resource.load()
    await resource.load()

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 1)
  }

  func testAStaleValueStaysOnScreenWhileItRevalidates() async {
    let clock = TestClock()
    let requests = Requests(results: [.success(1)])
    let resource = makeResource(requests: requests, clock: clock)
    await resource.load()

    clock.advance(by: AppCache.defaultMaxAge + .seconds(1))
    requests.suspends = true
    let revalidation = Task { await resource.load() }
    await requests.waitForCount(2)

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertTrue(resource.isRefreshing)

    requests.resolve(1, with: .success(2))
    await revalidation.value

    XCTAssertEqual(resource.state, .loaded(2))
    XCTAssertFalse(resource.isRefreshing)
  }

  /// A screen first drawn before the resource follows a new session (a restored sign-in) must
  /// still redraw when the resource's value changes.
  func testAScreenShowingAnotherSessionsResourceSeesItChange() async throws {
    let session = SessionStore.preview(account: .resourceTestAccount)
    let resource = makeResource(requests: Requests(results: [.success(1)]), session: session)
    await resource.load()
    await session.expire(try XCTUnwrap(session.authenticatedSession))

    let redraw = ObservationFlag()
    withObservationTracking {
      _ = resource.state
    } onChange: {
      redraw.isSet = true
    }
    resource.followSession()

    XCTAssertTrue(redraw.isSet)
  }

  func testCallsDuringARequestShareIt() async {
    let requests = Requests(suspends: true)
    let resource = makeResource(requests: requests)

    let first = Task { await resource.load() }
    await requests.waitForCount(1)
    let second = Task { await resource.load() }
    let refresh = Task { await resource.refresh() }
    await Task.yield()

    XCTAssertEqual(resource.state, .loading)
    requests.resolve(0, with: .success(1))
    await first.value
    await second.value
    await refresh.value

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 1)
  }

  func testAFirstLoadFailureCanBeRetried() async {
    let requests = Requests(results: [.failure(APIError.network), .success(1)])
    let resource = makeResource(requests: requests)

    await resource.load()
    XCTAssertEqual(resource.state, .failed(.network))

    await resource.refresh()
    XCTAssertEqual(resource.state, .loaded(1))
  }

  func testAFailedRefreshKeepsTheContent() async {
    let requests = Requests(results: [
      .success(1), .failure(APIError.network), .failure(URLError(.timedOut)),
    ])
    let resource = makeResource(requests: requests)

    await resource.load()
    await resource.refresh()
    await resource.refresh()

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 3)
  }

  /// A screen that redraws as its request fails (a spinner, then the error) shows its resource
  /// again each time (`loads(_:)` restarts its task): a failure that persists, such as a 5xx or a
  /// response the app can't decode, must not fetch in a loop. It stays until a retry or pull to
  /// refresh, the app's return to the foreground, or an invalidation asks again.
  func testAFailureStaysUntilSomethingAsksAgain() async {
    let cache = AppCache(session: .preview(account: .resourceTestAccount))
    let requests = Requests(results: Array(repeating: .failure(APIError.unavailable), count: 20))
    let resource: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.userProgress], fetch: requests.fetch)
    resource.beginViewing()

    for _ in 0..<5 {
      await resource.show()
    }
    XCTAssertEqual(resource.state, .failed(.unavailable))
    XCTAssertEqual(requests.count, 1)

    // Try again, or pull to refresh.
    await resource.refresh()
    await resource.show()
    XCTAssertEqual(requests.count, 2)

    // The app returns to the foreground.
    await resource.load()
    await resource.show()
    XCTAssertEqual(requests.count, 3)

    // A mutation changes what it reads.
    cache.invalidate([.userProgress])
    await requests.waitForCount(4)
    await resource.show()
    await resource.show()
    XCTAssertEqual(requests.count, 4)
    XCTAssertEqual(resource.state, .failed(.unavailable))
  }

  /// A failed revalidation keeps the content on screen, and a redraw doesn't ask again either.
  func testAFailedRevalidationIsntRetriedOnARedraw() async {
    let clock = TestClock()
    let requests = Requests(
      results: [.success(1)] + Array(repeating: .failure(APIError.unavailable), count: 10))
    let resource = makeResource(requests: requests, clock: clock)
    await resource.load()

    clock.advance(by: AppCache.defaultMaxAge + .seconds(1))
    for _ in 0..<3 {
      await resource.show()
    }

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 2)
  }

  func testDataThatNoLongerExistsReplacesTheContent() async {
    let requests = Requests(results: [.success(1), .failure(APIError.notFound)])
    let resource = makeResource(requests: requests)

    await resource.load()
    await resource.refresh()

    XCTAssertEqual(resource.state, .failed(.notFound))
  }

  func testAnExpiredSessionSignsOutAndDropsTheData() async {
    let session = SessionStore.preview(account: .resourceTestAccount)
    let requests = Requests(results: [.success(1), .failure(APIError.unauthorized)])
    let resource = makeResource(requests: requests, session: session)

    await resource.load()
    await resource.refresh()

    XCTAssertNil(session.authenticatedSession)
    XCTAssertEqual(resource.state, .idle)
  }

  func testAResponseForAnEndedSessionIsDiscarded() async throws {
    let session = SessionStore.preview(account: .resourceTestAccount)
    let requests = Requests(suspends: true)
    let resource = makeResource(requests: requests, session: session)

    let load = Task { await resource.load() }
    await requests.waitForCount(1)
    await session.expire(try XCTUnwrap(session.authenticatedSession))
    requests.resolve(0, with: .success(1))
    await load.value

    XCTAssertEqual(resource.state, .idle)
    XCTAssertEqual(requests.sessions.first??.bearerToken, "preview-session")
  }

  func testASessionChangeHidesAndDropsTheLearnersData() async throws {
    let session = SessionStore.preview(account: .resourceTestAccount)
    let cache = AppCache(session: session)
    let requests = Requests(results: [.success(1)])
    let resource: Resource<Int> = cache.resource(audience: .signedIn, fetch: requests.fetch)
    await resource.load()

    await session.expire(try XCTUnwrap(session.authenticatedSession))

    XCTAssertEqual(resource.state, .idle, "Hidden before the cache drops it")
    cache.followSession()
    await resource.load()
    XCTAssertEqual(resource.state, .idle)
    XCTAssertEqual(requests.count, 1, "A signed-in resource waits for a session")
  }

  func testPublicDataSurvivesASessionChange() async throws {
    let session = SessionStore.preview(account: .resourceTestAccount)
    let cache = AppCache(session: session)
    let requests = Requests(results: [.success(1)])
    let resource: Resource<Int> = cache.resource(audience: .everyone, fetch: requests.fetch)
    await resource.load()

    await session.expire(try XCTUnwrap(session.authenticatedSession))
    cache.followSession()
    await resource.load()

    XCTAssertEqual(resource.state, .loaded(1))
    XCTAssertEqual(requests.count, 1)
  }

  func testAMutationRevalidatesTheResourcesOnScreenThatReadItsDomain() async {
    let cache = AppCache(session: .preview(account: .resourceTestAccount))
    let progressRequests = Requests(results: [.success(1), .success(2)])
    let goalRequests = Requests(results: [.success(10)])
    let progress: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.userProgress], fetch: progressRequests.fetch)
    let goals: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.goals], fetch: goalRequests.fetch)
    await progress.load()
    await goals.load()
    progress.beginViewing()
    goals.beginViewing()

    cache.invalidate([.userProgress])
    await progressRequests.waitForCount(2)
    await progress.load()

    XCTAssertEqual(progress.state, .loaded(2))
    XCTAssertEqual(goalRequests.count, 1)
  }

  func testAMutationMarksAResourceOffScreenStaleUntilItsShown() async {
    let cache = AppCache(session: .preview(account: .resourceTestAccount))
    let requests = Requests(results: [.success(1), .success(2)])
    let resource: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.userProgress], fetch: requests.fetch)
    await resource.load()

    cache.invalidate([.userProgress])
    await Task.yield()
    XCTAssertEqual(requests.count, 1)
    XCTAssertEqual(resource.state, .loaded(1))

    await resource.load()
    XCTAssertEqual(resource.state, .loaded(2))
  }

  /// A screen a full-screen task covers stops viewing its resources (`isCoveredByTask` in
  /// `ResourceLoading`): every answer in a session invalidates Today behind it without a request,
  /// and Today revalidates once when the session closes and it's shown again.
  func testACoveredScreenRevalidatesOnceWhenUncovered() async {
    let cache = AppCache(session: .preview(account: .resourceTestAccount))
    let requests = Requests(results: [.success(1), .success(2)])
    let resource: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.userProgress], fetch: requests.fetch)
    resource.beginViewing()
    await resource.load()

    resource.endViewing()
    for _ in 0..<3 {
      cache.invalidate([.userProgress])
      await Task.yield()
    }
    XCTAssertEqual(requests.count, 1)
    XCTAssertEqual(resource.state, .loaded(1))

    resource.beginViewing()
    await resource.load()
    await resource.load()

    XCTAssertEqual(requests.count, 2)
    XCTAssertEqual(resource.state, .loaded(2))
  }

  /// A screen opened under a task (the session under the lesson a tap opened) loads what it has
  /// nothing of, so it shows at once when uncovered; a covered screen with data, even stale, waits.
  func testACoveredScreenLoadsOnlyWhatItHasNothingOf() async {
    let clock = TestClock()
    let requests = Requests(results: [.success(1), .success(2)])
    let resource = makeResource(requests: requests, clock: clock)

    await resource.prepare()
    XCTAssertEqual(resource.state, .loaded(1))

    clock.advance(by: AppCache.defaultMaxAge + .seconds(1))
    await resource.prepare()

    XCTAssertEqual(requests.count, 1)
    XCTAssertEqual(resource.state, .loaded(1))
  }

  func testAResponseThatPredatesAMutationIsDiscarded() async {
    let cache = AppCache(session: .preview(account: .resourceTestAccount))
    let requests = Requests(results: [.success(1)])
    let resource: Resource<Int> = cache.resource(
      audience: .signedIn, domains: [.userProgress], fetch: requests.fetch)
    await resource.load()
    resource.beginViewing()

    requests.suspends = true
    let refresh = Task { await resource.refresh() }
    await requests.waitForCount(2)
    cache.invalidate([.userProgress])
    await requests.waitForCount(3)
    requests.resolve(2, with: .success(3))
    requests.resolve(1, with: .success(2))
    await refresh.value
    await resource.load()

    XCTAssertEqual(resource.state, .loaded(3))
    XCTAssertEqual(requests.count, 3)
  }

  func testACancelledFirstLoadReturnsToIdle() async {
    let resource = makeResource(requests: Requests(results: [.failure(CancellationError())]))

    await resource.load()

    XCTAssertEqual(resource.state, .idle)
  }

  func testUpdateReplacesTheShownValue() async {
    let resource = makeResource(requests: Requests(results: [.success(1)]))
    await resource.load()
    let revision = resource.revision

    resource.update { $0 + 1 }

    XCTAssertEqual(resource.state, .loaded(2))
    XCTAssertNotEqual(resource.revision, revision)
  }

  private func makeResource(
    requests: Requests,
    session: SessionStore = .preview(account: .resourceTestAccount),
    clock: TestClock = TestClock(),
    isEmpty: @escaping (Int) -> Bool = { _ in false }
  ) -> Resource<Int> {
    AppCache(session: session, now: { clock.now }).resource(
      audience: .signedIn,
      isEmpty: isEmpty,
      fetch: requests.fetch)
  }
}

/// Answers a resource's requests from a script, or holds them until a test resolves them.
@MainActor
private final class Requests {
  var suspends: Bool
  private(set) var sessions: [AuthenticatedSession?] = []
  private var results: [Result<Int?, Error>]
  private var pending: [Int: CheckedContinuation<Int?, Error>] = [:]

  init(results: [Result<Int?, Error>] = [], suspends: Bool = false) {
    self.results = results
    self.suspends = suspends
  }

  var count: Int {
    sessions.count
  }

  func fetch(_ session: AuthenticatedSession?) async throws -> Int? {
    let index = sessions.count
    sessions.append(session)

    guard suspends else {
      return try results.isEmpty ? nil : results.removeFirst().get()
    }

    return try await withCheckedThrowingContinuation { pending[index] = $0 }
  }

  func resolve(_ index: Int, with result: Result<Int?, Error>) {
    pending.removeValue(forKey: index)?.resume(with: result)
  }

  func waitForCount(_ count: Int) async {
    for _ in 0..<1_000 where sessions.count < count {
      await Task.yield()
    }

    XCTAssertGreaterThanOrEqual(sessions.count, count)
  }
}

@MainActor
private final class TestClock {
  private(set) var now = ContinuousClock.now

  func advance(by duration: Duration) {
    now += duration
  }
}

extension CurrentAccount {
  fileprivate static let resourceTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "resource-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

private final class ObservationFlag: @unchecked Sendable {
  var isSet = false
}
