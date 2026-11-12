import XCTest

@testable import Zoonk

@MainActor
final class MindMapsStoreTests: XCTestCase {
  func testMapAlreadyBeingDrawnIsFollowedUntilTheListShowsItReady() async {
    let api = MindMapsAPIStub(server: .drawing, statuses: [.success(.drawing), .success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
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

    await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
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

    await store.follow(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertEqual(store.failure(goalId: "goal", chapterId: "chapter"), .unreachable)
    XCTAssertEqual(calls.status, 4)
  }

  func testANewerReadClearsTheConnectionErrorSoFollowingCanStartAgain() async {
    let api = MindMapsAPIStub(
      server: .writingLessons,
      statuses: [
        .success(.writingLessons), .failure(.network), .failure(.network), .failure(.network),
        .success(.drawing),
      ])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await store.follow(goalId: "goal", chapterId: "chapter")
    XCTAssertEqual(store.failure(goalId: "goal", chapterId: "chapter"), .unreachable)

    await list.refresh()

    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
  }

  func testAReadAlreadyOnItsWayKeepsTheRefusalAndANewerOneClearsIt() async {
    let limit = MindMapLimit(limit: .limitReached(period: .day, tier: .free), resource: .mindMap)
    let api = MindMapsAPIStub(server: .available, statuses: [], request: .refused(limit))
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    await api.holdNextList()
    let earlier = Task { await list.refresh() }
    while await !api.isHoldingList {
      await Task.yield()
    }

    await store.create(goalId: "goal", chapterId: "chapter")
    await api.releaseList()
    await earlier.value
    XCTAssertEqual(store.failure(goalId: "goal", chapterId: "chapter"), .refused(limit))

    await list.refresh()

    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
  }

  func testAReadyMapWhoseReadFailsIsFollowedUntilTheListShowsIt() async {
    let api = MindMapsAPIStub(server: .drawing, statuses: [.success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failLists(1)

    await store.follow(goalId: "goal", chapterId: "chapter")

    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
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

    await store.follow(goalId: "goal", chapterId: "chapter")

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
    await first.value

    await second.value
    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
  }

  func testStartedMapShowsOnItsWay() async {
    let api = MindMapsAPIStub(server: .available, statuses: [], startsAs: .drawing)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    await store.create(goalId: "goal", chapterId: "chapter")

    let calls = await api.calls
    XCTAssertNil(store.failure(goalId: "goal", chapterId: "chapter"))
    XCTAssertEqual(list.value?.chapters.first?.status, .drawing)
    XCTAssertEqual(calls.create, 1)
    XCTAssertEqual(calls.status, 0)
    XCTAssertFalse(store.requesting.contains("chapter"))
  }

  func testAListReadOnItsWayWhenAMapStartsCantUndoIt() async throws {
    let api = MindMapsAPIStub(
      server: .available, statuses: [.success(.ready)], startsAs: .drawing)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.holdNextList()
    let earlier = Task { await list.refresh() }
    while await !api.isHoldingList {
      await Task.yield()
    }

    let created = expectation(description: "The tap reads the list without the read before it")
    let creating = Task {
      await store.create(goalId: "goal", chapterId: "chapter")
      created.fulfill()
    }
    await fulfillment(of: [created], timeout: 5)
    await api.releaseList()
    await creating.value
    await earlier.value
    XCTAssertEqual(list.value?.chapters.first?.status, .drawing)

    // The map is drawn meanwhile, and the list's follower reads it.
    _ = try await api.status(token: "", goalId: "goal", chapterId: "chapter")
    await store.followList(goalId: "goal")

    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
  }

  func testLessonMapsReadBeforeCreateReadAgainOnceTheListShowsTheLessonsItWrote() async {
    let api = MindMapsAPIStub(
      server: .available, statuses: [.success(.drawing), .success(.ready)],
      startsAs: .writingLessons, lessonIds: ["first"])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    let lessons = store.lessonMaps(goalId: "goal", chapterId: "chapter")
    await list.load()
    await lessons.load()

    await store.create(goalId: "goal", chapterId: "chapter")
    await api.writeLessons(["first", "second"])
    await store.follow(goalId: "goal", chapterId: "chapter")
    await lessons.load()

    XCTAssertEqual(list.value?.lessonGroups.first?.lessonIds, ["first", "second"])
    XCTAssertEqual(lessons.value?.lessons.map(\.lessonId), ["first", "second"])
  }

  func testLessonMapsReadOnTheirWayWhenTheListShowsMoreReadAgain() async {
    let api = MindMapsAPIStub(server: .writingLessons, statuses: [], lessonIds: ["first"])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    let lessons = store.lessonMaps(goalId: "goal", chapterId: "chapter")
    await list.load()
    await api.holdNextChapterRead()

    let firstRead = Task { await lessons.load() }
    while await !api.isHoldingChapterRead {
      await Task.yield()
    }

    await api.writeLessons(["first", "second"])
    await list.refresh()
    await api.releaseChapterRead()
    await firstRead.value
    await lessons.load()

    XCTAssertEqual(lessons.value?.lessons.map(\.lessonId), ["first", "second"])
  }

  func testStartedMapWhoseReadFailsSaysTheServerWasntReached() async {
    let api = MindMapsAPIStub(server: .available, statuses: [], startsAs: .drawing)
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failLists(1)

    await store.create(goalId: "goal", chapterId: "chapter")

    XCTAssertEqual(store.failure(goalId: "goal", chapterId: "chapter"), .unreachable)
  }

  func testRefusedMapSaysWhatRanOut() async {
    let limit = MindMapLimit(limit: .limitReached(period: .month, tier: .free), resource: .lessons)
    let api = MindMapsAPIStub(server: .available, statuses: [], request: .refused(limit))
    let store = makeStore(api: api)

    await store.create(goalId: "goal", chapterId: "chapter")

    XCTAssertEqual(store.failure(goalId: "goal", chapterId: "chapter"), .refused(limit))
    let calls = await api.calls
    XCTAssertEqual(calls.status, 0)
    XCTAssertEqual(calls.list, 0)
  }

  func testSavingShowsAtOnceAndEveryCopyOfTheMapSaysSoOnceDone() async {
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.holdNextSave()

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    XCTAssertTrue(store.isSaved(Self.chapterKey, server: false))
    while await !api.isHoldingSave {
      await Task.yield()
    }

    await api.releaseSave()
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    XCTAssertEqual(list.value?.chapters.first?.saved, true)
    XCTAssertEqual(list.value?.saved.map(\.targetId), ["chapter"])
    XCTAssertFalse(store.saveFailed(goalId: "goal"))
  }

  func testAFailedSaveGoesBackAndSaysSo() async {
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failSaves(1)

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    XCTAssertFalse(
      store.isSaved(Self.chapterKey, server: list.value?.chapters.first?.saved ?? true))
    XCTAssertTrue(store.saveFailed(goalId: "goal"))
    XCTAssertFalse(store.saveFailed(goalId: "another goal"))
  }

  func testTapsFasterThanTheSaveEndInTheLastOneAskedFor() async {
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.holdNextSave()

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    while await !api.isHoldingSave {
      await Task.yield()
    }

    store.setSaved(false, target: Self.chapterTarget, goalId: "goal")
    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    store.setSaved(false, target: Self.chapterTarget, goalId: "goal")
    await api.releaseSave()
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    let calls = await api.calls
    XCTAssertEqual(calls.saves, [true, false])
    XCTAssertEqual(list.value?.chapters.first?.saved, false)
    XCTAssertEqual(list.value?.saved, [])
  }

  func testASaveInOneGoalIsReadAgainInEveryOtherGoalAlreadyRead() async {
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = makeStore(api: api)
    let other = store.list(goalId: "other goal")
    let otherMap = store.map(goalId: "other goal", chapterId: "chapter")
    await store.list(goalId: "goal").load()
    await other.load()
    await otherMap.load()

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    await other.load()
    await otherMap.load()
    XCTAssertEqual(other.value?.saved.map(\.targetId), ["chapter"])
    XCTAssertEqual(otherMap.value?.saved, true)
  }

  func testASaveTheServerTookIsReadAgainInEveryOtherGoalWhenALaterTapFails() async {
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = makeStore(api: api)
    let other = store.list(goalId: "other goal")
    await store.list(goalId: "goal").load()
    await other.load()
    await api.holdNextSave()

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    while await !api.isHoldingSave {
      await Task.yield()
    }

    store.setSaved(false, target: Self.chapterTarget, goalId: "goal")
    await api.failSaves(1)
    await api.releaseSave()
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    await other.load()
    let calls = await api.calls
    XCTAssertEqual(calls.saves, [true, false])
    XCTAssertTrue(store.saveFailed(goalId: "goal"))
    XCTAssertEqual(other.value?.saved.map(\.targetId), ["chapter"])
  }

  func testASaveOnItsWayStaysWithTheLearnerWhoAskedForIt() async {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner-a")
    let cache = AppCache(session: session)
    let api = MindMapsAPIStub(server: .ready, statuses: [])
    let store = MindMapsStore(api: api, cache: cache, drawingPoll: .zero, writingPoll: .zero)
    await api.holdNextSave()

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    while await !api.isHoldingSave {
      await Task.yield()
    }

    await accounts.signIn(session, as: "learner-b")
    cache.followSession()
    XCTAssertFalse(store.isSaved(Self.chapterKey, server: false), "B never sees A's tap")

    store.setSaved(true, target: Self.chapterTarget, goalId: "goal")
    await api.releaseSave()
    while !store.pendingSaves.isEmpty {
      await Task.yield()
    }

    let calls = await api.calls
    XCTAssertEqual(calls.saveTokens, ["token-learner-a", "token-learner-b"])
  }

  func testCreatingAllReadsTheListAgainToShowWhatStarted() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()

    await store.createAll(goalId: "goal")

    XCTAssertEqual(list.value?.chapters.first?.status, .drawing)
    XCTAssertNil(store.createAllFailures["goal"])
    XCTAssertFalse(store.creatingAll.contains("goal"))
  }

  func testAListReadOnItsWayWhenCreatingAllCantUndoIt() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.holdNextList()
    let earlier = Task { await list.refresh() }
    while await !api.isHoldingList {
      await Task.yield()
    }

    let created = expectation(description: "Create all reads the list without the read before it")
    let creating = Task {
      await store.createAll(goalId: "goal")
      created.fulfill()
    }
    await fulfillment(of: [created], timeout: 5)
    await api.releaseList()
    await creating.value
    await earlier.value

    XCTAssertEqual(list.value?.chapters.first?.status, .drawing)
    XCTAssertNil(store.createAllFailures["goal"])
  }

  func testAMapReadBeforeCreatingAllReadsAgainOnceTheListSaysItStarted() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    let map = store.map(goalId: "goal", chapterId: "chapter")
    await list.load()
    await map.load()

    await store.createAll(goalId: "goal")
    await map.load()

    XCTAssertEqual(map.value?.status, .drawing)
  }

  func testAMapReadOnItsWayWhenCreatingAllReadsAgainOnceTheListSaysItStarted() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    let map = store.map(goalId: "goal", chapterId: "chapter")
    await list.load()
    await api.holdNextChapterRead()

    let firstRead = Task { await map.load() }
    while await !api.isHoldingChapterRead {
      await Task.yield()
    }

    await store.createAll(goalId: "goal")
    await api.releaseChapterRead()
    await firstRead.value
    await map.load()

    XCTAssertEqual(map.value?.status, .drawing)
  }

  func testCreatingAllThatDoesntReachTheServerSaysSo() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failCreateAll(1)

    await store.createAll(goalId: "goal")

    XCTAssertEqual(store.createAllFailures["goal"], .unreachable)
    XCTAssertEqual(list.value?.chapters.first?.status, .available)
  }

  func testCreatingAllWhoseReadFailsSaysTheServerWasntReached() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failLists(1)

    await store.createAll(goalId: "goal")

    let calls = await api.calls
    XCTAssertEqual(store.createAllFailures["goal"], .unreachable)
    XCTAssertEqual(calls.createAll, 1)
  }

  func testANewerReadOfTheListClearsTheCreateAllError() async {
    let api = MindMapsAPIStub(server: .available, statuses: [])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    await api.failCreateAll(1)
    await store.createAll(goalId: "goal")
    XCTAssertEqual(store.createAllFailures["goal"], .unreachable)

    await list.refresh()

    XCTAssertNil(store.createAllFailures["goal"])
  }

  func testSavesNoLongerAvailableShowWhenNoChapterIsLeft() async {
    let gone = SavedMindMap(
      available: false, chapterId: nil, kind: .chapter, targetId: "gone", title: "Gone")
    let api = MindMapsAPIStub(server: .available, statuses: [])
    await api.answerLists(chapters: [], saved: [gone])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")

    await list.load()

    XCTAssertEqual(list.value?.saved, [gone])
  }

  func testTheListIsFollowedUntilNothingIsOnItsWay() async throws {
    let api = MindMapsAPIStub(server: .drawing, statuses: [.success(.ready)])
    let store = makeStore(api: api)
    let list = store.list(goalId: "goal")
    await list.load()
    // The stub's list says what its status route last answered: the map is drawn meanwhile.
    _ = try await api.status(token: "", goalId: "goal", chapterId: "chapter")

    await store.followList(goalId: "goal")

    let calls = await api.calls
    XCTAssertEqual(list.value?.chapters.first?.status, .ready)
    XCTAssertEqual(calls.list, 2)
  }

  func testAPlaceInADeckIsEachLearnersAndEachTabs() throws {
    let defaults = try XCTUnwrap(UserDefaults(suiteName: "MindMapPositionsTests"))
    defaults.removePersistentDomain(forName: "MindMapPositionsTests")
    let positions = MindMapPositions(defaults: defaults)
    let place = MindMapPosition(chapterId: "c2", key: MindMapKey(kind: .lesson, targetId: "l3"))

    positions.save(place, userId: "ana", goalId: "goal", tab: .lessons)

    XCTAssertEqual(positions.position(userId: "ana", goalId: "goal", tab: .lessons), place)
    XCTAssertNil(positions.position(userId: "ana", goalId: "goal", tab: .saved))
    XCTAssertNil(positions.position(userId: "bia", goalId: "goal", tab: .lessons))
    XCTAssertNil(positions.position(userId: "ana", goalId: "other", tab: .lessons))
  }

  private static let chapterKey = MindMapKey(kind: .chapter, targetId: "chapter")
  private static let chapterTarget = SaveTarget(
    key: chapterKey, title: "Chapter", chapterId: "chapter")

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
    var createAll = 0
    var list = 0
    var saves: [Bool] = []
    var saveTokens: [String] = []
    var status = 0
  }

  private(set) var calls = Calls()
  private var server: ChapterMindMap.Status
  private var statuses: [Result<ChapterMindMap.Status, APIError>]
  private let request: MindMapRequest
  private let startsAs: ChapterMindMap.Status?
  private var holdsFirstStatus: Bool
  private var held: CheckedContinuation<Void, Never>?
  /// The next list read answers with what the server had when it was asked, once released.
  private var holdsNextList = false
  private var heldList: CheckedContinuation<Void, Never>?
  private var listFailures = 0
  private var saved = false
  private var saveFailures = 0
  private var holdsNextSave = false
  private var heldSave: CheckedContinuation<Void, Never>?
  /// The next read of a chapter's map or lesson maps answers with what the server had when it was
  /// asked, once released.
  private var holdsNextChapterRead = false
  private var heldChapterRead: CheckedContinuation<Void, Never>?
  private var createAllFailures = 0
  private var answered: (chapters: [ChapterMindMap], saved: [SavedMindMap])?
  /// The chapter's written lessons, every one open.
  private var lessonIds: [String]

  init(
    server: ChapterMindMap.Status, statuses: [Result<ChapterMindMap.Status, APIError>],
    request: MindMapRequest = .read, startsAs: ChapterMindMap.Status? = nil,
    holdsFirstStatus: Bool = false, lessonIds: [String] = []
  ) {
    self.server = server
    self.statuses = statuses
    self.request = request
    self.startsAs = startsAs
    self.holdsFirstStatus = holdsFirstStatus
    self.lessonIds = lessonIds
  }

  var isHolding: Bool { held != nil }

  func release() {
    held?.resume()
    held = nil
  }

  func failLists(_ count: Int) {
    listFailures = count
  }

  var isHoldingList: Bool { heldList != nil }

  func holdNextList() {
    holdsNextList = true
  }

  func releaseList() {
    heldList?.resume()
    heldList = nil
  }

  func failSaves(_ count: Int) {
    saveFailures = count
  }

  func answerLists(chapters: [ChapterMindMap], saved: [SavedMindMap]) {
    answered = (chapters, saved)
  }

  func failCreateAll(_ count: Int) {
    createAllFailures = count
  }

  func writeLessons(_ ids: [String]) {
    lessonIds = ids
  }

  var isHoldingSave: Bool { heldSave != nil }

  var isHoldingChapterRead: Bool { heldChapterRead != nil }

  func holdNextChapterRead() {
    holdsNextChapterRead = true
  }

  func releaseChapterRead() {
    heldChapterRead?.resume()
    heldChapterRead = nil
  }

  func holdNextSave() {
    holdsNextSave = true
  }

  func releaseSave() {
    heldSave?.resume()
    heldSave = nil
  }

  func list(token: String, goalId: String) async throws -> GoalMindMaps {
    calls.list += 1
    let read = GoalMindMaps(
      chapters: answered?.chapters ?? [chapter],
      createOffer: MindMapCreateOffer(eligible: 0, needLessons: 0, startable: 0, stop: nil),
      firstTab: .chapters,
      lessonGroups: lessonIds.isEmpty
        ? []
        : [
          LessonMapGroup(
            chapterId: "chapter", count: lessonIds.count, locked: 0, lessonIds: lessonIds)
        ],
      saved: answered?.saved
        ?? (saved
          ? [
            SavedMindMap(
              available: true, chapterId: "chapter", kind: .chapter, targetId: "chapter",
              title: "Chapter")
          ] : []))

    if holdsNextList {
      holdsNextList = false
      await withCheckedContinuation { heldList = $0 }
    }

    if listFailures > 0 {
      listFailures -= 1
      throw APIError.network
    }

    return read
  }

  func lessonMaps(token: String, goalId: String, chapterId: String) async throws
    -> ChapterLessonMaps
  {
    let written = lessonIds
    await holdChapterRead()

    return ChapterLessonMaps(
      chapter: .init(id: chapterId, position: 1, title: "Chapter"),
      lessons: written.enumerated().map { index, id in
        .init(lessonId: id, locked: false, map: nil, position: index + 1, saved: false, title: id)
      })
  }

  func save(token: String, goalId: String, key: MindMapKey, saved: Bool) async throws -> Bool {
    calls.saves.append(saved)
    calls.saveTokens.append(token)
    let fails = saveFailures > 0

    if fails {
      saveFailures -= 1
    }

    if holdsNextSave {
      holdsNextSave = false
      await withCheckedContinuation { heldSave = $0 }
    }

    if fails {
      throw APIError.network
    }

    self.saved = saved
    return saved
  }

  func createAll(token: String, goalId: String) async throws {
    calls.createAll += 1

    if createAllFailures > 0 {
      createAllFailures -= 1
      throw APIError.network
    }

    server = .drawing
  }

  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap {
    let read = chapter
    await holdChapterRead()
    return read
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

  private func holdChapterRead() async {
    if holdsNextChapterRead {
      holdsNextChapterRead = false
      await withCheckedContinuation { heldChapterRead = $0 }
    }
  }

  private var chapter: ChapterMindMap {
    ChapterMindMap(
      chapterId: "chapter", image: nil, lessonsToWrite: 0, outline: nil, position: 1,
      saved: saved, status: server, subject: nil, title: "Chapter")
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
