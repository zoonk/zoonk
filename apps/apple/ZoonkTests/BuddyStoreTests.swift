import XCTest

@testable import Zoonk

@MainActor
final class BuddyStoreTests: XCTestCase {
  func testPickedBuddyShowsAtOnceAndStaysWhenSaved() async {
    let api = BuddyAPIStub()
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    await store.status.load()

    await store.save(BuddyChoice(kind: .otto, name: "Octo", glasses: .round))

    XCTAssertEqual(store.status.value?.buddy.kind, .otto)
    XCTAssertEqual(store.status.value?.buddy.name, "Octo")
    XCTAssertEqual(store.status.value?.buddy.picked, true)
    XCTAssertFalse(store.saveFailed)
  }

  func testFailedSavePutsThePreviousBuddyBack() async {
    let api = BuddyAPIStub()
    api.saveFailure = APIError.network
    let store = BuddyStore(api: api, cache: AppCache(session: .preview(account: .buddyTestAccount)))
    await store.status.load()

    await store.save(BuddyChoice(kind: .otto, name: "Octo", glasses: .round))

    XCTAssertEqual(store.status.value?.buddy.kind, .zu)
    XCTAssertNil(store.status.value?.buddy.name)
    XCTAssertTrue(store.saveFailed)
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
  var saveFailure: Error?
  var pages: [String?: EarlierQuestionsPage] = [:]

  func status(timeZone: String, token: String) async throws -> BuddyStatus {
    .fixture
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    if let saveFailure {
      throw saveFailure
    }
  }

  func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage {
    pages[cursor] ?? EarlierQuestionsPage(questions: [], nextCursor: nil)
  }

  func answer(insightId: String, accepted: Bool, token: String) async throws {}
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
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "buddy-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
