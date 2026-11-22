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

  func testOlderEarlierQuestionsAppend() async {
    let api = BuddyAPIStub()
    api.pages = [
      nil: EarlierQuestionsPage(questions: [.fixture("new")], nextCursor: "older"),
      "older": EarlierQuestionsPage(questions: [.fixture("old")], nextCursor: nil),
    ]
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    await store.earlierQuestions.load()

    await store.loadOlderQuestions()

    XCTAssertEqual(store.earlierQuestions.value?.questions.map(\.id), ["new", "old"])
    XCTAssertNil(store.earlierQuestions.value?.nextCursor)
  }
}

private final class BuddyAPIStub: BuddyAPIClient, @unchecked Sendable {
  var shownStatus = BuddyStatus.fixture
  var saveFailure: Error?
  var answerFailure: Error?
  var pages: [String?: EarlierQuestionsPage] = [:]

  func status(timeZone: String, token: String) async throws -> BuddyStatus {
    shownStatus
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    if let saveFailure {
      throw saveFailure
    }
  }

  func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage {
    pages[cursor] ?? EarlierQuestionsPage(questions: [], nextCursor: nil)
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

extension MemoryInsight {
  fileprivate static let fixture = MemoryInsight(
    createdAt: .now, goalId: nil, id: "insight", kind: .tip, message: "Review before bed.",
    planChange: nil, status: .pending, studyTime: nil)
}

extension Components.Schemas.EarlierQuestion {
  fileprivate static func fixture(_ id: String) -> Self {
    .init(
      answer: "Answer", askedAt: .now, courseTitle: "Course", id: id, lessonTitle: nil,
      question: "Question")
  }
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
    try await activate("0 of 1 mission", in: window)
    try await waitForTestCondition("The day sheet did not appear") {
      window.rootViewController?.presentedViewController != nil
    }
  }
}

@MainActor
private final class OpenedMissions {
  var count = 0
}
