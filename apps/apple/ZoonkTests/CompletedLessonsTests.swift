import XCTest

@testable import Zoonk

@MainActor
final class CompletedLessonsTests: XCTestCase {
  func testNextPageLeavesOutLessonsAlreadyShown() async {
    let api = CompletedLessonsAPIStub(
      firstPages: [page(["a", "b"], next: "two")], nextPage: page(["b", "c"], next: nil))
    let store = makeStore(api: api)
    let lessons = store.lessons(goal)
    await lessons.load()

    await store.loadMore(goal)

    XCTAssertEqual(lessons.value, page(["a", "b", "c"], next: nil))
    let cursors = await api.cursors
    XCTAssertEqual(cursors, [nil, "two"])
  }

  func testNextPageOfAListReadAgainIsDropped() async {
    let api = CompletedLessonsAPIStub(
      firstPages: [page(["a"], next: "two"), page(["b", "a"], next: "two")],
      nextPage: page(["c"], next: nil), holdsNextPage: true)
    let store = makeStore(api: api)
    let lessons = store.lessons(goal)
    await lessons.load()

    let more = Task { await store.loadMore(goal) }
    await api.untilNextPageIsAsked()
    await lessons.refresh()
    await api.releaseNextPage()
    await more.value

    XCTAssertEqual(lessons.value, page(["b", "a"], next: "two"))
  }

  func testAGroupsLessonsAreAListOfTheirOwn() async {
    let api = CompletedLessonsAPIStub(
      firstPages: [page(["a", "b"], next: nil), page(["b"], next: nil)],
      nextPage: page([], next: nil))
    let store = makeStore(api: api)
    let math = CompletedLessonsQuery(goalId: "goal", group: "math")

    await store.lessons(goal).load()
    await store.lessons(math).load()

    XCTAssertEqual(store.lessons(goal).value, page(["a", "b"], next: nil))
    XCTAssertEqual(store.lessons(math).value, page(["b"], next: nil))
    let groups = await api.groups
    XCTAssertEqual(groups, [nil, "math"])
  }

  private let goal = CompletedLessonsQuery(goalId: "goal")

  private func page(_ ids: [String], next: String?) -> CompletedLessonsPage {
    CompletedLessonsPage(
      lessons: ids.map {
        CompletedLesson(
          lessonId: $0, title: $0, chapterTitle: nil, finishedOn: "2026-11-01", available: true,
          saved: false)
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
  private(set) var groups: [String?] = []
  private var firstPages: [CompletedLessonsPage]
  private let nextPage: CompletedLessonsPage
  private let holdsNextPage: Bool
  private var heldPage: TestContinuation<Void>?
  private var askedForNextPage: TestContinuation<Void>?

  init(
    firstPages: [CompletedLessonsPage], nextPage: CompletedLessonsPage, holdsNextPage: Bool = false
  ) {
    self.firstPages = firstPages
    self.nextPage = nextPage
    self.holdsNextPage = holdsNextPage
  }

  func list(token: String, query: CompletedLessonsQuery, cursor: String?) async throws
    -> CompletedLessonsPage
  {
    cursors.append(cursor)
    groups.append(query.group)

    guard cursor != nil else {
      return firstPages.removeFirst()
    }

    if holdsNextPage {
      await withTestVoidContinuation { continuation in
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

    await withTestVoidContinuation { askedForNextPage = $0 }
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
