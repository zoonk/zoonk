import XCTest

@testable import Zoonk

@MainActor
final class SavedLessonsStoreTests: XCTestCase {
  func testASaveTheServerTookShowsInEveryCopyBeforeItsTapIsDropped() async throws {
    let api = SavedLessonsAPIStub(lessons: [Self.lesson("older")])
    let store = makeStore(api: api)
    var elsewhere: [(String, Bool)] = []
    store.showElsewhere = { elsewhere.append(($0, $1)) }
    let list = store.lessons(goalId: "goal")
    await list.load()
    store.runStarted(lessonId: "new", saved: false)

    store.saves.set(true, Self.target("new"), goalId: "goal")
    XCTAssertTrue(store.saves.isSaved("new", server: false))
    _ = try await waitForTestCondition("The save did not end") { store.saves.pending.isEmpty }

    XCTAssertEqual(list.value?.map(\.lessonId), ["new", "older"], "newest save first")
    XCTAssertEqual(store.runSaved(lessonId: "new"), true)
    XCTAssertEqual(elsewhere.map(\.0), ["new"])
    XCTAssertEqual(elsewhere.map(\.1), [true])
    XCTAssertNil(store.saves.failure(goalId: "goal"))
  }

  func testAFailedRemovalStaysSavedAndSaysItCouldntRemove() async throws {
    let api = SavedLessonsAPIStub(lessons: [Self.lesson("saved")])
    await api.failSaves()
    let store = makeStore(api: api)
    let list = store.lessons(goalId: "goal")
    await list.load()
    store.runStarted(lessonId: "saved", saved: true)

    store.saves.set(false, Self.target("saved"), goalId: "goal")
    XCTAssertFalse(store.saves.isSaved("saved", server: true))
    _ = try await waitForTestCondition("The save did not end") { store.saves.pending.isEmpty }

    XCTAssertTrue(store.saves.isSaved("saved", server: true))
    XCTAssertEqual(store.runSaved(lessonId: "saved"), true)
    XCTAssertEqual(list.value?.map(\.lessonId), ["saved"])
    XCTAssertEqual(store.saves.failure(goalId: "goal")?.saved, false, "says it couldn't remove")
    XCTAssertNil(store.saves.failure(goalId: "another goal"))
  }

  func testARemovedRowKeepsItsPlaceAndASecondTapSavesItThere() {
    let rows = ["a", "b", "c"].map(Self.lesson)
    var kept = KeptRows<SavedLesson>()

    kept.keep(rows[1], shown: rows)
    XCTAssertEqual(kept.rows([rows[0], rows[2]]).map(\.lessonId), ["a", "b", "c"])

    // Saved again, the server lists it first: it stays where the learner's thumb is.
    XCTAssertEqual(kept.rows([rows[1], rows[0], rows[2]]).map(\.lessonId), ["a", "b", "c"])
  }

  private func makeStore(api: SavedLessonsAPIStub) -> SavedLessonsStore {
    SavedLessonsStore(
      api: api, cache: AppCache(session: .preview(account: .savedLessonsTestAccount)))
  }

  private static func lesson(_ id: String) -> SavedLesson {
    SavedLesson(lessonId: id, title: id, chapterTitle: nil, available: true)
  }

  private static func target(_ id: String) -> LessonSaveTarget {
    LessonSaveTarget(lessonId: id, title: id, chapterTitle: nil)
  }
}

private actor SavedLessonsAPIStub: SavedLessonsAPIClient {
  private let lessons: [SavedLesson]
  private var savesFail = false

  init(lessons: [SavedLesson]) {
    self.lessons = lessons
  }

  func failSaves() {
    savesFail = true
  }

  func list(token: String, goalId: String) async throws -> [SavedLesson] {
    lessons
  }

  func save(token: String, goalId: String, lessonId: String, saved: Bool) async throws -> Bool {
    if savesFail {
      throw APIError.network
    }

    return saved
  }
}

extension CurrentAccount {
  fileprivate static let savedLessonsTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "saved-lessons-test-user",
      image: nil, name: "Learner", username: "learner"))
}
