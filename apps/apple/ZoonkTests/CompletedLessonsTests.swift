import XCTest

@testable import Zoonk

@MainActor
final class CompletedLessonsTests: XCTestCase {
  func testNextPageLeavesOutLessonsAlreadyShown() async {
    let api = CompletedLessonsAPIStub(
      firstPages: [page(["a", "b"], next: "two")], nextPage: page(["b", "c"], next: nil))
    let store = makeStore(api: api)
    let lessons = store.lessons(goalId: "goal")
    await lessons.load()

    await store.loadMore(goalId: "goal")

    XCTAssertEqual(lessons.value, page(["a", "b", "c"], next: nil))
    let cursors = await api.cursors
    XCTAssertEqual(cursors, [nil, "two"])
  }

  func testNextPageOfAListReadAgainIsDropped() async {
    let api = CompletedLessonsAPIStub(
      firstPages: [page(["a"], next: "two"), page(["b", "a"], next: "two")],
      nextPage: page(["c"], next: nil), holdsNextPage: true)
    let store = makeStore(api: api)
    let lessons = store.lessons(goalId: "goal")
    await lessons.load()

    let more = Task { await store.loadMore(goalId: "goal") }
    await api.untilNextPageIsAsked()
    await lessons.refresh()
    await api.releaseNextPage()
    await more.value

    XCTAssertEqual(lessons.value, page(["b", "a"], next: "two"))
  }

  func testDayTitleFollowsTheLearnersOwnDay() throws {
    let saoPaulo = try XCTUnwrap(TimeZone(identifier: "America/Sao_Paulo"))
    // 01:30 on November 2 in UTC is still November 1 in São Paulo.
    let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-02T01:30:00Z"))

    XCTAssertEqual(completedLessonsDayTitle("2026-11-01", now: now, timeZone: saoPaulo), "Today")
    XCTAssertEqual(
      completedLessonsDayTitle("2026-10-31", now: now, timeZone: saoPaulo), "Yesterday")
    XCTAssertEqual(completedLessonsDayTitle("2026-11-02", now: now, timeZone: .gmt), "Today")
    XCTAssertFalse(
      completedLessonsDayTitle("2026-10-29", now: now, timeZone: saoPaulo).contains("2026"))
    XCTAssertTrue(
      completedLessonsDayTitle("2025-10-29", now: now, timeZone: saoPaulo).contains("2025"))
  }

  private func page(_ ids: [String], next: String?) -> CompletedLessonsPage {
    CompletedLessonsPage(
      lessons: ids.map {
        CompletedLesson(lessonId: $0, title: $0, chapterTitle: nil, finishedOn: "2026-11-01")
      },
      nextCursor: next)
  }

  private func makeStore(api: CompletedLessonsAPIStub) -> CompletedLessonsStore {
    CompletedLessonsStore(
      api: api, cache: AppCache(session: .preview(account: .completedLessonsTestAccount)))
  }
}

private actor CompletedLessonsAPIStub: CompletedLessonsAPIClient {
  private(set) var cursors: [String?] = []
  private var firstPages: [CompletedLessonsPage]
  private let nextPage: CompletedLessonsPage
  private let holdsNextPage: Bool
  private var heldPage: CheckedContinuation<Void, Never>?
  private var askedForNextPage: CheckedContinuation<Void, Never>?

  init(
    firstPages: [CompletedLessonsPage], nextPage: CompletedLessonsPage, holdsNextPage: Bool = false
  ) {
    self.firstPages = firstPages
    self.nextPage = nextPage
    self.holdsNextPage = holdsNextPage
  }

  func list(token: String, goalId: String, cursor: String?) async throws -> CompletedLessonsPage {
    cursors.append(cursor)

    guard cursor != nil else {
      return firstPages.removeFirst()
    }

    if holdsNextPage {
      await withCheckedContinuation { continuation in
        heldPage = continuation
        askedForNextPage?.resume()
        askedForNextPage = nil
      }
    }

    return nextPage
  }

  func untilNextPageIsAsked() async {
    guard heldPage == nil else {
      return
    }

    await withCheckedContinuation { askedForNextPage = $0 }
  }

  func releaseNextPage() {
    heldPage?.resume()
    heldPage = nil
  }
}

extension CurrentAccount {
  fileprivate static let completedLessonsTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "completed-lessons-test-user",
      image: nil, name: "Learner", username: "learner"))
}
