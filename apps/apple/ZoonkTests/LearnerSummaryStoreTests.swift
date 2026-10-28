import XCTest

@testable import Zoonk

@MainActor
final class LearnerSummaryStoreTests: XCTestCase {
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
  private(set) var requestCount = 0

  init(nextChanges: [Date]) {
    self.nextChanges = nextChanges
  }

  func getSummary(token: String) async throws -> LearnerSummary {
    requestCount += 1

    return LearnerSummary(
      activeGoalID: nil,
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      nextChangeAt: nextChanges.removeFirst(),
      readAt: .now,
      tier: .free,
      timeZone: "America/Sao_Paulo")
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
