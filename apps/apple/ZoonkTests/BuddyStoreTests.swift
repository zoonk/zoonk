import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class BuddyStoreTests: XCTestCase {
  func testPickedBuddyShowsAtOnceAndStaysWhenSaved() async {
    let api = BuddyAPIStub()
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    await store.status.load()

    let saved = await store.save(BuddyChoice(kind: .otto, name: "Octo", glasses: .round))

    XCTAssertEqual(store.status.value?.buddy.kind, .otto)
    XCTAssertEqual(store.status.value?.buddy.name, "Octo")
    XCTAssertEqual(store.status.value?.buddy.picked, true)
    XCTAssertTrue(saved)
  }

  func testFailedSavePutsThePreviousBuddyBack() async {
    let api = BuddyAPIStub()
    api.saveFailure = APIError.network
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    await store.status.load()

    let saved = await store.save(BuddyChoice(kind: .otto, name: "Octo", glasses: .round))

    XCTAssertEqual(store.status.value?.buddy.kind, .zu)
    XCTAssertNil(store.status.value?.buddy.name)
    XCTAssertFalse(saved)
  }

  func testExpiredSessionOnSaveSignsOutWithoutRollingBack() async {
    let session = SessionStore.preview(account: .buddyTestAccount)
    let api = BuddyAPIStub()
    api.saveFailure = APIError.unauthorized
    let store = BuddyStore(api: api, cache: AppCache(session: session))
    await store.status.load()

    let saved = await store.save(BuddyChoice(kind: .otto, name: "Octo", glasses: .round))

    XCTAssertNil(session.authenticatedSession)
    XCTAssertTrue(saved, "a signed-out learner is told nothing")
  }

  func testShowMoreAddsTheNextConversationsOnce() async {
    let api = BuddyAPIStub()
    api.pages = [
      "": BuddyConversations(
        conversations: [.fixture("a"), .fixture("b")], currentId: "a", nextCursor: "b"),
      "b": BuddyConversations(
        conversations: [.fixture("b"), .fixture("c")], currentId: nil, nextCursor: nil),
    ]
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    let list = store.conversations(goalId: "goal")
    await list.load()

    await store.loadMoreConversations(goalId: "goal")

    XCTAssertEqual(list.value?.conversations.map(\.id), ["a", "b", "c"])
    XCTAssertEqual(list.value?.currentId, "a", "the first page says which one a visit opens")
    XCTAssertNil(list.value?.nextCursor)
    XCTAssertNil(store.nextConversations["goal"])
  }

  func testAVisitOpensTodaysConversationOrANewOneOnceTheListSays() {
    XCTAssertNil(BuddyOpening.next(request: nil, isOpen: false, list: .waiting))
    XCTAssertEqual(
      BuddyOpening.next(request: nil, isOpen: false, list: .read(currentId: "today")),
      .conversation(id: "today"))
    XCTAssertEqual(
      BuddyOpening.next(request: nil, isOpen: false, list: .read(currentId: nil)), .new(ask: nil))
    XCTAssertEqual(
      BuddyOpening.next(request: nil, isOpen: false, list: nil), .new(ask: nil),
      "a guest has no list")
    XCTAssertNil(
      BuddyOpening.next(request: nil, isOpen: true, list: .read(currentId: "today")),
      "a conversation left open stays")
    XCTAssertEqual(
      BuddyOpening.next(
        request: .conversation(id: "linked"), isOpen: true, list: .read(currentId: "today")),
      .conversation(id: "linked"))
    XCTAssertEqual(
      BuddyOpening.next(request: .new(ask: "Why?"), isOpen: false, list: .waiting),
      .new(ask: "Why?"))
  }

  func testTheConversationListDecodesAsTheAPISendsIt() async throws {
    let id = "0b9a6f3e-5d1c-4f7a-9a51-2f6c3d8e7b10"
    let transport = AnsweringTransport(
      answer: #"""
        {"conversations":[{"id":"\#(id)","title":"Why do orbits curve?",\#
        "lastAskedAt":"2026-11-26T14:05:09.123Z"}],"currentId":null,"nextCursor":"\#(id)"}
        """#)
    let api = BuddyAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport))

    let page = try await api.conversations(
      goalId: "c3b30782-4de7-4386-83fa-934eee74e049", cursor: id, token: "token")

    XCTAssertEqual(page.conversations.first?.title, "Why do orbits curve?")
    XCTAssertEqual(
      page.conversations.first?.lastAskedAt.timeIntervalSince1970 ?? 0, 1_795_701_909.123,
      accuracy: 0.001)
    XCTAssertNil(page.currentId)
    XCTAssertEqual(page.nextCursor, id)
    XCTAssertEqual(
      transport.paths.value,
      ["/goals/c3b30782-4de7-4386-83fa-934eee74e049/buddy/conversations?cursor=\(id)"])
  }

  func testExpiredSessionOnAnInsightAnswerIsObsolete() async {
    let session = SessionStore.preview(account: .buddyTestAccount)
    let api = BuddyAPIStub()
    api.answerFailure = APIError.unauthorized
    let store = BuddyStore(api: api, cache: AppCache(session: session))

    let result = await store.answer(.fixture, accepted: true)

    guard case .obsolete = result else {
      return XCTFail("Expected an obsolete result, got \(result)")
    }
    XCTAssertNil(session.authenticatedSession)
  }
}

private final class BuddyAPIStub: BuddyAPIClient, @unchecked Sendable {
  var shownStatus = BuddyStatus.fixture
  var saveFailure: Error?
  var answerFailure: Error?
  /// Each cursor's page; the first page's key is "".
  var pages: [String: BuddyConversations] = [:]

  func status(timeZone: String, token: String) async throws -> BuddyStatus {
    shownStatus
  }

  func conversations(goalId: String, cursor: String?, token: String) async throws
    -> BuddyConversations
  {
    pages[cursor ?? ""] ?? BuddyConversations(conversations: [], currentId: nil, nextCursor: nil)
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    if let saveFailure {
      throw saveFailure
    }
  }

  func answer(insightId: String, accepted: Bool, quote: PlanChangeQuote?, token: String)
    async throws -> MemoryInsight?
  {
    if let answerFailure {
      throw answerFailure
    }

    return nil
  }
}

extension BuddyStatus {
  fileprivate static let fixture = BuddyStatus(
    belt: .init(
      bpPerLevel: 100, bpToNextLevel: 50, color: "white", isMaxLevel: false, level: 1,
      progressInLevel: 50, totalBrainPower: 50),
    buddy: .init(glasses: .round, kind: .zu, name: nil, picked: false),
    energy: .init(current: 72, state: .awake, studiedToday: true),
    firstSteps: nil,
    glasses: [],
    nextStage: nil,
    stage: .baby,
    thisWeek: .init(fixes: 0, newIdeas: 0, reviews: 0),
    today: nil)
}

extension BuddyConversation {
  fileprivate static func fixture(_ id: String) -> BuddyConversation {
    BuddyConversation(id: id, lastAskedAt: .now, title: "Question \(id)")
  }
}

private struct AnsweringTransport: ClientTransport {
  let answer: String
  let paths = RecordedPaths()

  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String)
    async throws -> (HTTPResponse, HTTPBody?)
  {
    paths.append(request.path ?? "")
    return (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(answer)
    )
  }
}

private final class RecordedPaths: @unchecked Sendable {
  private let lock = NSLock()
  private var stored: [String] = []

  var value: [String] {
    lock.withLock { stored }
  }

  func append(_ path: String) {
    lock.withLock { stored.append(path) }
  }
}

extension MemoryInsight {
  fileprivate static let fixture = MemoryInsight(
    createdAt: .now, goalId: nil, id: "insight", kind: .tip, message: "Review before bed.",
    planChange: nil, status: .pending, studyTime: nil)
}

extension CurrentAccount {
  fileprivate static let buddyTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "buddy-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}

@MainActor
final class BuddyDayOpeningTests: XCTestCase {
  func testClosingDayBeforeAMissionAnswersOpensNothingThenOrLater() async throws {
    let (window, api, opened) = try await waitingMission()
    try await closeRequestSheet(in: window)
    try await waitForTestCondition("The sheet did not close") {
      window.rootViewController?.presentedViewController == nil
    }
    await api.releaseHeldCall()
    // A closed day sheet must not open a mission after its response.
    let closedDayWindow: Duration = .milliseconds(200)
    try await Task.sleep(for: closedDayWindow)
    XCTAssertEqual(opened.count, 0)
    try await showDay(in: window)
    XCTAssertEqual(opened.count, 0)
  }

  private func waitingMission() async throws
    -> (UIWindow, StudyAPIStub, OpenedMissions)
  {
    let api = StudyAPIStub(
      openings: [
        try JSONDecoder().decode(
          StudyBlockOpening.self,
          from: Data(#"{"kind":"lesson","lessonId":"l1","sessionId":"s1"}"#.utf8))
      ],
      holdsOpening: true)
    let buddy = BuddyAPIStub()
    buddy.shownStatus.today = .init(
      fullMeal: .init(bonus: 10, earned: false), goalId: PageServer.goalID,
      localDate: "2026-11-16",
      missions: [
        .init(
          done: 0, kind: .somethingNew,
          opens: .init(value1: .case1(.init(blockId: "b1", kind: .block))), status: .todo, total: 1)
      ])
    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneGoalSummary(kind: .learn))
    await dependencies.learnerSummaryStore.summary.load()
    let store = BuddyStore(api: buddy, cache: dependencies.cache)
    await store.status.load()
    let today = TodayStore(api: api, cache: dependencies.cache)
    let opened = OpenedMissions()
    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack { BuddyScreen() }
        .environment(store)
        .environment(today)
        .appDependencies(dependencies)
        .environment(AppRouter())
        .environment(\.tutorPlaces, TutorPlaces { _ in opened.count += 1 })
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)
    try await showDay(in: window)
    try await activate(
      where: { $0.contains(String(localized: "Do a new lesson", table: "Today")) }, in: window)
    try await api.waitForHeldCall()
    return (window, api, opened)
  }

  private func showDay(in window: UIWindow) async throws {
    try await activate("Zu's Energy", in: window)
    try await waitForTestCondition("The day sheet did not appear") {
      window.rootViewController?.presentedViewController != nil
    }
  }
}

@MainActor
private final class OpenedMissions {
  var count = 0
}
