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

  func testAGoalSwitchThatFailsSaysSoAndReadsNoSummary() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture], switchError: .unavailable)
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    let switched = await store.switchGoal(to: "goal")

    guard case .failed(.unavailable) = switched else {
      return XCTFail("Expected the switch to fail, got \(switched)")
    }
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

    guard case .done = switched else {
      return XCTFail("Expected the switch to save, got \(switched)")
    }
    let requestCount = await api.requestCount
    XCTAssertEqual(requestCount, 2)
  }

  func testASwitchTheLearnerReplacedSaysNothingWhenItFails() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture, .distantFuture])
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    await api.holdSwitch(to: "replaced", failingWith: .unavailable)
    let replaced = Task { await store.switchGoal(to: "replaced") }
    await api.waitForHeldSwitch()
    let latest = await store.switchGoal(to: "latest")
    await api.releaseHeldSwitch()
    let replacedResult = await replaced.value

    guard case .done = latest else {
      return XCTFail("Expected the latest switch to save, got \(latest)")
    }
    guard case .obsolete = replacedResult else {
      return XCTFail("Expected the replaced switch to say nothing, got \(replacedResult)")
    }
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
  private var heldSwitch: (goalID: String, error: APIError)?
  private var heldSwitchRelease: CheckedContinuation<Void, Never>?
  private(set) var requestCount = 0

  init(nextChanges: [Date], switchError: APIError? = nil) {
    self.nextChanges = nextChanges
    self.switchError = switchError
  }

  func getSummary(token: String) async throws -> LearnerSummary {
    requestCount += 1

    return LearnerSummary(
      activeGoalID: nil,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: nextChanges.removeFirst(),
      places: LearnerPlaces(
        completedLessons: false, exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .free,
      timeZone: "America/Sao_Paulo",
      todayBlocksLeft: nil)
  }

  func switchGoal(token: String, goalID: String) async throws {
    if let heldSwitch, heldSwitch.goalID == goalID {
      await withCheckedContinuation { heldSwitchRelease = $0 }
      throw heldSwitch.error
    }

    if let switchError {
      throw switchError
    }
  }

  func holdSwitch(to goalID: String, failingWith error: APIError) {
    heldSwitch = (goalID, error)
  }

  func waitForHeldSwitch() async {
    while heldSwitchRelease == nil {
      await Task.yield()
    }
  }

  func releaseHeldSwitch() {
    heldSwitchRelease?.resume()
  }
}

extension CurrentAccount {
  fileprivate static let summaryTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "summary-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
