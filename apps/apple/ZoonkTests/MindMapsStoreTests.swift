import XCTest

@testable import Zoonk

@MainActor
final class MindMapsStoreTests: XCTestCase {
  func testMapAlreadyBeingDrawnIsFollowedUntilItsDoneWithoutAskingAgain() async {
    let api = MindMapsAPIStub(statuses: [.success(.drawing), .success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    let failure = await store.follow(goalId: "goal", chapterId: "chapter", from: .drawing)

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(calls.status, 2)
    XCTAssertEqual(calls.create, 0)
    XCTAssertEqual(calls.list, 2)
  }

  func testDroppedConnectionKeepsFollowingTheMap() async {
    let api = MindMapsAPIStub(statuses: [
      .success(.drawing), .failure(.network), .success(.drawing), .success(.failed),
    ])
    let store = makeStore(api: api)

    let failure = await store.follow(goalId: "goal", chapterId: "chapter", from: .drawing)

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(calls.status, 4)
    XCTAssertEqual(calls.list, 1)
  }

  func testThreeReadsInARowThatDontReachTheServerSaySo() async {
    let api = MindMapsAPIStub(statuses: [
      .success(.writingLessons), .failure(.network), .failure(.unavailable), .failure(.network),
      .success(.ready),
    ])
    let store = makeStore(api: api)

    let failure = await store.follow(goalId: "goal", chapterId: "chapter", from: .writingLessons)

    let calls = await api.calls
    XCTAssertEqual(failure, .unreachable)
    XCTAssertEqual(calls.status, 4)
    XCTAssertEqual(calls.list, 0)
  }

  func testRowSaysTheDrawingStartedOnceTheLessonsAreWritten() async {
    let api = MindMapsAPIStub(statuses: [
      .success(.writingLessons), .success(.drawing), .success(.drawing), .success(.ready),
    ])
    let store = makeStore(api: api)

    _ = await store.follow(goalId: "goal", chapterId: "chapter", from: .writingLessons)

    let calls = await api.calls
    XCTAssertEqual(calls.status, 4)
    XCTAssertEqual(calls.list, 2)
  }

  func testStartedMapIsLeftToItsRowToFollow() async {
    let api = MindMapsAPIStub(statuses: [.success(.drawing)])
    let store = makeStore(api: api)

    let failure = await store.create(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(failure)
    XCTAssertEqual(calls.create, 1)
    XCTAssertEqual(calls.status, 0)
    XCTAssertFalse(store.requesting.contains("chapter"))
  }

  func testRefusedMapSaysWhatRanOut() async {
    let limit = MindMapLimit(limit: .limitReached(period: .month, tier: .free), isLessons: true)
    let api = MindMapsAPIStub(statuses: [], request: .refused(limit))
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

private actor MindMapsAPIStub: MindMapsAPIClient {
  struct Calls {
    var create = 0
    var list = 0
    var status = 0
  }

  private(set) var calls = Calls()
  private var statuses: [Result<ChapterMindMap.Status, APIError>]
  private let request: MindMapRequest

  init(statuses: [Result<ChapterMindMap.Status, APIError>], request: MindMapRequest = .read) {
    self.statuses = statuses
    self.request = request
  }

  func list(token: String, goalId: String) async throws -> GoalMindMaps {
    calls.list += 1
    return GoalMindMaps(chapters: [])
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

  func create(token: String, goalId: String, chapterId: String) async throws -> MindMapRequest {
    calls.create += 1
    return request
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
