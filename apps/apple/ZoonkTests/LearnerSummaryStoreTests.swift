import XCTest
import ZoonkAPI

@testable import Zoonk

@MainActor
final class LearnerSummaryStoreTests: XCTestCase {
  func testSummaryConsentDecodesEveryDecision() throws {
    let summary =
      #"{"account":{"email":"ana@zoonk.test","image":null,"name":"Ana"},"activeGoalId":null,"analytics":{"disabled":false,"goal":null,"plan":"free","shareUsageData":null,"username":null},"buddy":{"beltColor":"white","energy":null,"glasses":"round","kind":"zu","name":null,"studiedToday":false},"day":null,"goals":[],"identity":{"expiresAt":1793186000000,"isAnonymous":false,"signedInAt":1761650000000,"userId":"0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0a1"},"level":null,"missions":null,"nextChangeAt":0,"places":{"exam":false,"mindMaps":false,"readyMistakes":0,"speaking":false},"readAt":0,"tier":"free","timeZone":null,"today":null}"#
    for choice in ["true", "false", "null"] {
      let resolved = summary.replacingOccurrences(
        of: #""shareUsageData":null"#,
        with: "\"shareUsageData\":null,\"usageDataSharing\":\(choice)")
      let fixture = "{\"summary\":\(resolved)}"
      let response = try JSONDecoder().decode(
        Components.Schemas.LearnerSummaryResponse.self, from: Data(fixture.utf8))
      XCTAssertEqual(
        response.summary.analytics.usageDataSharing, choice == "null" ? nil : choice == "true")
    }
  }

  func testSummaryIsReadAgainWhenItSaysItChanges() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.now.addingTimeInterval(-1), .distantFuture])
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    await store.refreshAtNextChange()

    let requestCount = await api.requestCount
    XCTAssertEqual(requestCount, 2)
    XCTAssertEqual(store.summary.value?.nextChangeAt, .distantFuture)
  }

  func testAGoalSwitchThatFailsSaysSoAndReadsNoSummary() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture], switchError: .unavailable)
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    let switched = await store.switchGoal(to: "goal")

    XCTAssertFalse(switched)
    let requestCount = await api.requestCount
    XCTAssertEqual(requestCount, 1)
  }

  func testASwitchedGoalReadsTheSummaryAgainBeforeSayingSo() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture, .distantFuture])
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    let switched = await store.switchGoal(to: "goal")

    XCTAssertTrue(switched)
    let requestCount = await api.requestCount
    XCTAssertEqual(requestCount, 2)
  }

  func testSignedOutLearnerHasNoSummaryRequest() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture])
    let store = LearnerSummaryStore(api: api, cache: AppCache(session: .preview()))

    await store.summary.load()

    XCTAssertEqual(store.summary.state, .idle)
    let requestCount = await api.requestCount
    XCTAssertEqual(requestCount, 0)
  }
}

private actor LearnerSummaryAPIStub: LearnerSummaryAPIClient {
  private var nextChanges: [Date]
  private let switchError: APIError?
  private(set) var requestCount = 0

  init(nextChanges: [Date], switchError: APIError? = nil) {
    self.nextChanges = nextChanges
    self.switchError = switchError
  }

  func getSummary(token: String) async throws -> LearnerSummary {
    requestCount += 1

    return LearnerSummary(
      activeGoalID: nil,
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: nextChanges.removeFirst(),
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .free,
      timeZone: "America/Sao_Paulo",
      todayBlocksLeft: nil)
  }

  func switchGoal(token: String, goalID: String) async throws {
    if let switchError {
      throw switchError
    }
  }
}

extension CurrentAccount {
  fileprivate static let summaryTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "summary-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
