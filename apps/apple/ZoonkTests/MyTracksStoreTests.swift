import XCTest

@testable import Zoonk

@MainActor
final class MyTracksStoreTests: XCTestCase {
  func testPaginationPreservesOrderDeduplicatesAndRetainsItemsOnFailure() async {
    let first = MyTrack(id: "first", title: "First track", totalCourses: 2)
    let second = MyTrack(id: "second", title: "Second track", totalCourses: 3)
    let api = TracksAPIStub(results: [
      .success(MyTracksPage(tracks: [first], nextCursor: "page-two")),
      .failure(MyCoursesAPIError.network),
      .success(MyTracksPage(tracks: [first, second], nextCursor: nil)),
    ])
    let store = MyTracksStore(api: api, session: session())
    await store.load()
    await store.load(more: true)
    XCTAssertEqual(store.items, [first])
    XCTAssertEqual(store.nextCursor, "page-two")
    XCTAssertEqual(store.failure, .network)
    await store.load(more: true)
    XCTAssertEqual(store.items, [first, second])
    XCTAssertNil(store.nextCursor)
    XCTAssertNil(store.failure)
    let cursors = await api.cursors
    XCTAssertEqual(cursors, [nil, "page-two", "page-two"])
  }

  func testUnauthorizedRefreshClearsPriorPrivateTrackTitles() async {
    let account = session()
    let api = TracksAPIStub(results: [
      .success(
        MyTracksPage(
          tracks: [.init(id: "private", title: "Private goal", totalCourses: 2)], nextCursor: nil)),
      .failure(MyCoursesAPIError.unauthorized),
    ])
    let store = MyTracksStore(api: api, session: account)
    await store.load()
    await store.load(force: true)
    XCTAssertNil(account.authenticatedSession)
    XCTAssertTrue(store.items.isEmpty)
    XCTAssertFalse(store.isWorking)
  }

  func testLateTrackResponseCannotRestoreSignedOutContent() async throws {
    let started = expectation(description: "Track request began")
    let api = SuspendedTracksAPI(requestDidStart: started.fulfill)
    let account = session()
    let identity = try XCTUnwrap(account.authenticatedSession)
    let store = MyTracksStore(api: api, session: account)
    let request = Task { await store.load() }
    await fulfillment(of: [started], timeout: 1)
    await account.expire(identity)
    await store.load()
    await api.resolve()
    await request.value
    XCTAssertTrue(store.items.isEmpty)
    XCTAssertFalse(store.isWorking)
    XCTAssertFalse(store.hasLoaded)
  }

  private func session() -> SessionStore {
    .preview(
      account: CurrentAccount(
        account: .init(deletion: .init(hasAppleAccount: false), subscription: nil),
        user: .init(
          displayUsername: "tracks", email: "tracks@zoonk.test", id: "tracks", image: nil,
          name: "Tracks QA", username: "tracks")))
  }
}

private actor TracksAPIStub: MyCoursesAPIClient {
  private var results: [Result<MyTracksPage, Error>]
  private(set) var cursors: [String?] = []
  init(results: [Result<MyTracksPage, Error>]) { self.results = results }
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    cursors.append(cursor)
    return try results.removeFirst().get()
  }
  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    throw MyCoursesAPIError.unavailable
  }
}

private actor SuspendedTracksAPI: MyCoursesAPIClient {
  let requestDidStart: @Sendable () -> Void
  private var continuation: CheckedContinuation<MyTracksPage, Never>?
  init(requestDidStart: @escaping @Sendable () -> Void) { self.requestDidStart = requestDidStart }
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      requestDidStart()
    }
  }
  func resolve() {
    continuation?.resume(
      returning: .init(
        tracks: [.init(id: "private", title: "Private goal", totalCourses: 2)], nextCursor: nil))
    continuation = nil
  }
  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    throw MyCoursesAPIError.unavailable
  }
}
