import XCTest

@testable import Zoonk

@MainActor
final class MyCoursesStoreTests: XCTestCase {
  func testInitialLoadPublishesCoursesAndUsesCurrentSession() async {
    let page = MyCoursesPage(
      courses: [.myCoursesTestFixture],
      hasMore: true,
      nextCursor: "next-page")
    let api = MyCoursesAPIStub(results: [.success(page)])
    let store = makeStore(api: api)

    await store.loadCourses()

    XCTAssertEqual(store.coursesState, .loaded(page))
    let requests = await api.requests
    XCTAssertEqual(
      requests,
      [MyCoursesRequest(query: MyCoursesQuery(), token: "preview-session")])
  }

  func testPresentationLoadReusesLoadedCourses() async {
    let page = MyCoursesPage(
      courses: [.myCoursesTestFixture],
      hasMore: false,
      nextCursor: nil)
    let api = MyCoursesAPIStub(results: [.success(page)])
    let store = makeStore(api: api)

    await store.loadCourses()
    await store.loadCoursesIfNeeded()

    let requests = await api.requests
    XCTAssertEqual(requests.count, 1)
  }

  func testEmptyLoadPublishesEmptyState() async {
    let api = MyCoursesAPIStub(
      results: [
        .success(MyCoursesPage(courses: [], hasMore: false, nextCursor: nil))
      ])
    let store = makeStore(api: api)

    await store.loadCourses()

    XCTAssertEqual(store.coursesState, .empty)
  }

  func testNetworkFailureCanBeRetried() async {
    let page = MyCoursesPage(
      courses: [.myCoursesTestFixture],
      hasMore: false,
      nextCursor: nil)
    let store = makeStore(
      api: MyCoursesAPIStub(
        results: [
          .failure(MyCoursesAPIError.network),
          .success(page),
        ]))

    await store.loadCourses()
    XCTAssertEqual(store.coursesState, .failed(.network))

    await store.loadCourses(force: true)
    XCTAssertEqual(store.coursesState, .loaded(page))
  }

  func testLoadMoreAppendsUniqueCourses() async {
    let initialPage = MyCoursesPage(
      courses: [.myCoursesTestFixture],
      hasMore: true,
      nextCursor: "next-page")
    let nextPage = MyCoursesPage(
      courses: [.myCoursesTestFixture, .personalMyCoursesTestFixture],
      hasMore: false,
      nextCursor: nil)
    let api = MyCoursesAPIStub(results: [.success(initialPage), .success(nextPage)])
    let store = makeStore(api: api)

    await store.loadCourses()
    await store.loadMoreCourses()

    XCTAssertEqual(
      store.coursesState,
      .loaded(
        MyCoursesPage(
          courses: [.myCoursesTestFixture, .personalMyCoursesTestFixture],
          hasMore: false,
          nextCursor: nil)))
    let requests = await api.requests
    XCTAssertEqual(
      requests.map(\.query),
      [MyCoursesQuery(), MyCoursesQuery(cursor: "next-page")])
  }

  func testSearchPaginatesWithTheSameNormalizedQuery() async {
    let api = MyCoursesAPIStub(results: [
      .success(
        MyCoursesPage(courses: [.myCoursesTestFixture], hasMore: true, nextCursor: "search-page")),
      .success(
        MyCoursesPage(courses: [.personalMyCoursesTestFixture], hasMore: false, nextCursor: nil)),
    ])
    let store = makeStore(api: api)

    await store.loadCourses(query: "  sky  ")
    await store.loadCoursesIfNeeded(query: "sky")
    await store.loadMoreCourses()

    let queries = await api.requests.map(\.query)
    XCTAssertEqual(
      queries, [MyCoursesQuery(query: "sky"), MyCoursesQuery(cursor: "search-page", query: "sky")])
    XCTAssertEqual(
      store.coursesState,
      .loaded(
        MyCoursesPage(
          courses: [.myCoursesTestFixture, .personalMyCoursesTestFixture], hasMore: false,
          nextCursor: nil)))
  }

  func testClearingSearchRestoresTheUnfilteredLibrary() async {
    let page = MyCoursesPage(courses: [.myCoursesTestFixture], hasMore: false, nextCursor: nil)
    let api = MyCoursesAPIStub(results: [
      .success(MyCoursesPage(courses: [], hasMore: false, nextCursor: nil)), .success(page),
    ])
    let store = makeStore(api: api)

    await store.loadCourses(query: "missing")
    XCTAssertEqual(store.coursesState, .empty)
    await store.loadCoursesIfNeeded(query: "")

    XCTAssertEqual(store.coursesState, .loaded(page))
    let queries = await api.requests.map(\.query)
    XCTAssertEqual(queries, [MyCoursesQuery(query: "missing"), MyCoursesQuery()])
  }

  func testLateSearchResponseCannotReplaceANewerQuery() async {
    let started = expectation(description: "First search started")
    let latestPage = MyCoursesPage(
      courses: [.personalMyCoursesTestFixture], hasMore: false, nextCursor: nil)
    let api = SupersededMyCoursesSearchAPI(latestPage: latestPage, requestDidStart: started.fulfill)
    let store = makeStore(api: api)
    let firstRequest = Task { await store.loadCourses(query: "sky") }
    await fulfillment(of: [started], timeout: 1)

    await store.loadCourses(query: "personal")
    await api.resolveFirstSearch()
    await firstRequest.value

    XCTAssertEqual(store.coursesState, .loaded(latestPage))
  }

  func testLosingTheSessionClearsLoadedCourses() async throws {
    let page = MyCoursesPage(
      courses: [.myCoursesTestFixture],
      hasMore: false,
      nextCursor: nil)
    let api = MyCoursesAPIStub(results: [.success(page)])
    let session = SessionStore.preview(account: makeMyCoursesTestAccount())
    let store = MyCoursesStore(api: api, session: session)
    let authenticatedSession = try XCTUnwrap(session.authenticatedSession)

    await store.loadCourses()
    await session.expire(authenticatedSession)
    await store.loadCoursesIfNeeded()

    XCTAssertEqual(store.coursesState, .idle)
    let requests = await api.requests
    XCTAssertEqual(requests.count, 1)
  }

  func testLateResponseDoesNotRestoreCoursesAfterTheSessionExpires() async throws {
    let requestStarted = expectation(description: "My Courses request started")
    let api = SuspendedMyCoursesAPIStub(requestDidStart: requestStarted.fulfill)
    let session = SessionStore.preview(account: makeMyCoursesTestAccount())
    let store = MyCoursesStore(api: api, session: session)
    let authenticatedSession = try XCTUnwrap(session.authenticatedSession)
    let request = Task { await store.loadCourses() }
    await fulfillment(of: [requestStarted], timeout: 1)

    await session.expire(authenticatedSession)
    await store.loadCoursesIfNeeded()
    await api.resolve(
      with: MyCoursesPage(
        courses: [.myCoursesTestFixture],
        hasMore: false,
        nextCursor: nil))
    await request.value

    XCTAssertEqual(store.coursesState, .idle)
  }

  func testUnauthorizedLoadExpiresTheMatchingSession() async {
    let session = SessionStore.preview(account: makeMyCoursesTestAccount())
    let store = MyCoursesStore(
      api: MyCoursesAPIStub(results: [.failure(MyCoursesAPIError.unauthorized)]),
      session: session)

    await store.loadCourses()

    XCTAssertNil(session.account)
    XCTAssertEqual(store.coursesState, .idle)
  }

  private func makeStore(api: any MyCoursesAPIClient) -> MyCoursesStore {
    MyCoursesStore(
      api: api,
      session: .preview(account: makeMyCoursesTestAccount()))
  }
}

/// Delays an older network response to verify that a newer search owns the visible result.
private actor SupersededMyCoursesSearchAPI: MyCoursesAPIClient {
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    MyTracksPage(tracks: [], nextCursor: nil)
  }
  let latestPage: MyCoursesPage
  let requestDidStart: @Sendable () -> Void
  private var continuation: CheckedContinuation<MyCoursesPage, Never>?

  init(latestPage: MyCoursesPage, requestDidStart: @escaping @Sendable () -> Void) {
    self.latestPage = latestPage
    self.requestDidStart = requestDidStart
  }

  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    guard request.query.query == "sky" else { return latestPage }
    return await withCheckedContinuation { continuation in
      self.continuation = continuation
      requestDidStart()
    }
  }

  func resolveFirstSearch() {
    continuation?.resume(
      returning: MyCoursesPage(courses: [.myCoursesTestFixture], hasMore: false, nextCursor: nil))
    continuation = nil
  }
}

private func makeMyCoursesTestAccount() -> CurrentAccount {
  CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "my-courses-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

private actor MyCoursesAPIStub: MyCoursesAPIClient {
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    MyTracksPage(tracks: [], nextCursor: nil)
  }
  private var results: [Result<MyCoursesPage, Error>]
  private(set) var requests: [MyCoursesRequest] = []

  init(results: [Result<MyCoursesPage, Error>]) {
    self.results = results
  }

  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    requests.append(request)

    guard !results.isEmpty else {
      throw MyCoursesAPIError.unavailable
    }

    return try results.removeFirst().get()
  }
}

private actor SuspendedMyCoursesAPIStub: MyCoursesAPIClient {
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    MyTracksPage(tracks: [], nextCursor: nil)
  }
  private let requestDidStart: @Sendable () -> Void
  private var continuation: CheckedContinuation<MyCoursesPage, any Error>?

  init(requestDidStart: @escaping @Sendable () -> Void) {
    self.requestDidStart = requestDidStart
  }

  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    try await withCheckedThrowingContinuation { continuation in
      self.continuation = continuation
      requestDidStart()
    }
  }

  func resolve(with page: MyCoursesPage) {
    continuation?.resume(returning: page)
    continuation = nil
  }
}
