import XCTest

@testable import Zoonk

@MainActor
final class MindMapsStoreTests: XCTestCase {
  func testMapAlreadyBeingDrawnIsFollowedUntilItsDoneWithoutAskingAgain() async {
    let api = MindMapsAPIStub(statuses: [.success(.generating), .success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(calls.status, 2)
    XCTAssertEqual(calls.create, 0)
    XCTAssertEqual(calls.list, 2)
  }

  func testDroppedConnectionKeepsFollowingTheMap() async {
    let api = MindMapsAPIStub(statuses: [
      .success(.generating), .failure(.network), .success(.generating), .success(.failed),
    ])
    let store = makeStore(api: api)

    await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(calls.status, 4)
    XCTAssertEqual(calls.list, 1)
    XCTAssertNil(store.failures["chapter"])
  }

  func testStartedMapIsLeftToItsTileToFollow() async {
    let api = MindMapsAPIStub(statuses: [.success(.generating)])
    let store = makeStore(api: api)

    await store.create(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(calls.create, 1)
    XCTAssertEqual(calls.status, 0)
    XCTAssertFalse(store.requesting.contains("chapter"))
  }

  func testRefusedMapSaysThePlanReachedItsMaps() async {
    let api = MindMapsAPIStub(statuses: [], creates: false)
    let store = makeStore(api: api)

    await store.create(goalId: "goal", chapterId: "chapter")

    XCTAssertEqual(store.failures["chapter"], .limit)
    let calls = await api.calls
    XCTAssertEqual(calls.status, 0)
  }

  private func makeStore(api: MindMapsAPIStub) -> MindMapsStore {
    MindMapsStore(
      api: api, cache: AppCache(session: .preview(account: .mindMapsTestAccount)),
      pollInterval: .zero)
  }
}

private actor MindMapsAPIStub: MindMapsAPIClient {
  struct Calls {
    var create = 0
    var list = 0
    var status = 0
  }

  private(set) var calls = Calls()
  /// Each status read's answer in turn; `.ready` once they run out.
  private var statuses: [Result<ChapterMindMap.Status, APIError>]
  private let creates: Bool

  init(statuses: [Result<ChapterMindMap.Status, APIError>], creates: Bool = true) {
    self.statuses = statuses
    self.creates = creates
  }

  func list(token: String, goalId: String) async throws -> GoalMindMaps {
    calls.list += 1
    return GoalMindMaps(chapters: [], nextChapter: nil)
  }

  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap {
    throw APIError.notFound
  }

  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  {
    calls.status += 1
    return try statuses.isEmpty ? .ready : statuses.removeFirst().get()
  }

  func create(token: String, goalId: String, chapterId: String) async throws -> Bool {
    calls.create += 1
    return creates
  }
}

extension CurrentAccount {
  fileprivate static let mindMapsTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "mind-maps-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
