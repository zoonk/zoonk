import XCTest

@testable import Zoonk

@MainActor
final class MindMapsStoreTests: XCTestCase {
  func testMapAlreadyBeingDrawnIsFollowedUntilTheListShowsItReady() async {
    let api = MindMapsAPIStub(server: .drawing, statuses: [.success(.drawing), .success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let failure = await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
    XCTAssertEqual(calls.status, 2)
    XCTAssertEqual(calls.create, 0)
  }

  func testDroppedConnectionKeepsFollowingTheMap() async {
    let api = MindMapsAPIStub(
      server: .drawing,
      statuses: [.success(.drawing), .failure(.network), .success(.drawing), .success(.failed)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let failure = await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(list.value?.chapters.first?.status, .failed)
    XCTAssertEqual(calls.status, 4)
  }

  func testThreeBeatsInARowThatDontComeThroughSaySo() async {
    let api = MindMapsAPIStub(
      server: .writingLessons,
      statuses: [
        .success(.writingLessons), .failure(.network), .failure(.unavailable),
        .failure(.network), .success(.ready),
      ])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let failure = await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(failure, .unreachable)
    XCTAssertEqual(calls.status, 4)
  }

  func testAReadyMapWhoseReadFailsIsFollowedUntilTheListShowsIt() async {
    let api = MindMapsAPIStub(server: .drawing, statuses: [.success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failLists(1)

    let failure = await store.follow(goalId: "goal", chapterId: "chapter")

    XCTAssertNil(failure)
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
  }

  func testRowSaysTheDrawingStartedOnceTheLessonsAreWritten() async {
    let api = MindMapsAPIStub(
      server: .writingLessons,
      statuses: [
        .success(.writingLessons), .success(.drawing), .success(.drawing), .success(.ready),
      ])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    _ = await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
    XCTAssertEqual(calls.status, 4)
    XCTAssertEqual(calls.list, 3)
  }

  func testAnotherRowKeepsFollowingWhenTheFirstOneCloses() async {
    let api = MindMapsAPIStub(
      server: .drawing, statuses: [.success(.drawing), .success(.ready)], holdsFirstStatus: true)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let first = Task { await store.follow(goalId: "goal", chapterId: "chapter") }
    while await !api.isHolding {
      await Task.yield()
    }

    let second = Task { await store.follow(goalId: "goal", chapterId: "chapter") }
    first.cancel()
    await api.release()
    _ = await first.value

    let failure = await second.value
    XCTAssertNil(failure)
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
  }

  func testStartedMapShowsOnItsWay() async {
    let api = MindMapsAPIStub(server: .available, statuses: [], startsAs: .drawing)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let failure = await store.create(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(list.value?.chapters.first?.status, .drawing)
    XCTAssertEqual(calls.create, 1)
    XCTAssertEqual(calls.status, 0)
    XCTAssertFalse(store.requesting.contains("chapter"))
  }

  func testStartedMapWhoseReadFailsSaysTheServerWasntReached() async {
    let api = MindMapsAPIStub(server: .available, statuses: [], startsAs: .drawing)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failLists(1)

    let failure = await store.create(goalId: "goal", chapterId: "chapter")

    XCTAssertEqual(failure, .unreachable)
  }

  func testRefusedMapSaysWhatRanOut() async {
    let limit = MindMapLimit(limit: .limitReached(period: .month, tier: .free), resource: .lessons)
    let api = MindMapsAPIStub(server: .available, statuses: [], request: .refused(limit))
    let store = makeStore(api: api)

    let failure = await store.create(goalId: "goal", chapterId: "chapter")

    XCTAssertEqual(failure, .refused(limit))
    let calls = await api.calls
    XCTAssertEqual(calls.status, 0)
    XCTAssertEqual(calls.list, 0)
  }

  private func makeStore(api: MindMapsAPIStub) -> MindMapsStore {
    MindMapsStore(
      api: api, cache: AppCache(session: .preview(account: .mindMapsTestAccount)),
      drawingPoll: .zero, writingPoll: .zero)
  }
}

/// A server whose reads agree: the list shows the status its status route last answered. The last
/// status answers every read after it.
private actor MindMapsAPIStub: MindMapsAPIClient {
  struct Calls {
    var create = 0
    var list = 0
    var status = 0
  }

  private(set) var calls = Calls()
  private var server: ChapterMindMap.Status
  private var statuses: [Result<ChapterMindMap.Status, APIError>]
  private let request: MindMapRequest
  private let startsAs: ChapterMindMap.Status?
  private var holdsFirstStatus: Bool
  private var held: CheckedContinuation<Void, Never>?
  private var listFailures = 0

  init(
    server: ChapterMindMap.Status, statuses: [Result<ChapterMindMap.Status, APIError>],
    request: MindMapRequest = .read, startsAs: ChapterMindMap.Status? = nil,
    holdsFirstStatus: Bool = false
  ) {
    self.server = server
    self.statuses = statuses
    self.request = request
    self.startsAs = startsAs
    self.holdsFirstStatus = holdsFirstStatus
  }

  var isHolding: Bool { held != nil }

  func release() {
    held?.resume()
    held = nil
  }

  func failLists(_ count: Int) {
    listFailures = count
  }

  func list(token: String, goalId: String) async throws -> GoalMindMaps {
    calls.list += 1

    if listFailures > 0 {
      listFailures -= 1
      throw APIError.network
    }

    return GoalMindMaps(chapters: [chapter])
  }

  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap {
    chapter
  }

  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  {
    calls.status += 1

    if holdsFirstStatus {
      holdsFirstStatus = false
      await withCheckedContinuation { held = $0 }
    }

    let next = statuses.count > 1 ? statuses.removeFirst() : statuses.first ?? .success(server)
    let status = try next.get()
    server = status
    return status
  }

  func create(token: String, goalId: String, chapterId: String) async throws -> MindMapRequest {
    calls.create += 1

    if let startsAs {
      server = startsAs
    }

    return request
  }

  private var chapter: ChapterMindMap {
    ChapterMindMap(
      chapterId: "chapter", image: nil, lessonsToWrite: 0, outline: nil, position: 1,
      status: server, subject: nil, title: "Chapter")
  }
}

extension CurrentAccount {
  fileprivate static let mindMapsTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "mind-maps-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
