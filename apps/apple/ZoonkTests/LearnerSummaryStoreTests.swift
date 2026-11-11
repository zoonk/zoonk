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

  func testASavedCountryStaysShownWhenTheSummaryCantBeReadAgain() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture], region: "AR")
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    await api.failReads()
    let saved = await store.setTargetRegion("ES", goalID: "goal")
    await store.summary.refresh()

    XCTAssertTrue(saved)
    XCTAssertEqual(store.summary.value?.goals.first?.variety?.region, "ES")
  }

  func testACountrySaveThatTimesOutReadsTheGoalAgainSinceItMayHaveLanded() async {
    let api = LearnerSummaryAPIStub(
      nextChanges: [.distantFuture, .distantFuture], region: "AR", landsThenTimesOut: true)
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    let saved = await store.setTargetRegion("ES", goalID: "goal")
    await store.summary.load()

    XCTAssertFalse(saved)
    XCTAssertEqual(store.summary.value?.goals.first?.variety?.region, "ES")
  }

  func testANewContentCountryShowsItsRebuildEvenWhenTheSummaryCantBeReadAgain() async {
    let api = LearnerSummaryAPIStub(nextChanges: [.distantFuture], contentCountry: "BR")
    let store = LearnerSummaryStore(
      api: api,
      cache: AppCache(session: .preview(account: .summaryTestAccount)))

    await store.summary.load()
    await api.failReads()
    let saved = await store.setContentCountry("PT", goalID: "finance")
    await store.summary.refresh()

    let row = store.summary.value?.goals.first?.contentCountry
    XCTAssertTrue(saved)
    XCTAssertEqual(row?.code, "PT")
    XCTAssertEqual(row?.rebuild, .preparing)
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
  /// The country the server has for the one language goal; no goal without it.
  private var region: String??
  private let landsThenTimesOut: Bool
  /// The country the server has for the one finance goal; no goal without it.
  private var contentCountry: String?
  private var readsFail = false
  private(set) var requestCount = 0

  init(
    nextChanges: [Date], switchError: APIError? = nil, region: String?? = .none,
    contentCountry: String? = nil, landsThenTimesOut: Bool = false
  ) {
    self.nextChanges = nextChanges
    self.switchError = switchError
    self.region = region
    self.contentCountry = contentCountry
    self.landsThenTimesOut = landsThenTimesOut
  }

  func setContentCountry(token: String, goalID: String, country: String?) async throws
    -> ContentCountryChange
  {
    contentCountry = country
    return .saved(Self.row(country ?? "BR", rebuild: .preparing))
  }

  func retryRebuild(token: String, goalID: String) async throws {}

  private static func row(_ code: String, rebuild: ContentCountry.Rebuild) -> ContentCountry {
    ContentCountry(
      code: code, name: code, kind: .content, editable: true, source: .picked,
      lessonVariety: nil, rebuild: rebuild)
  }

  func failReads() {
    readsFail = true
  }

  func setTargetRegion(token: String, goalID: String, region: String?) async throws -> Bool {
    self.region = .some(region)

    if landsThenTimesOut {
      throw APIError.network
    }

    return true
  }

  func getSummary(token: String) async throws -> LearnerSummary {
    requestCount += 1

    if readsFail {
      throw APIError.network
    }

    return LearnerSummary(
      activeGoalID: nil,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(),
      buddyName: nil,
      goals: region.map { region in
        [
          LearnerGoal(
            dailyMinutes: 15, id: "goal", kind: .language, language: "en", status: .active, targetDate: nil,
            displayName: "Spanish", title: "Learn Spanish",
            variety: LanguageVariety(
              language: "es", region: region,
              choices: ["AR", "ES", "MX"].map {
                Components.Schemas.RegionChoice(code: $0, name: $0, taught: $0 == "MX")
              }))
        ]
      }
        ?? contentCountry.map { country in
          [
            LearnerGoal(
              dailyMinutes: 15, id: "finance", kind: .learn, language: "en", status: .active, targetDate: nil,
              displayName: "Personal finance", title: "Personal finance",
              contentCountry: Self.row(country, rebuild: .none))
          ]
        } ?? [],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: nextChanges.removeFirst(),
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: false, mindMaps: false,
        readyMistakes: 0, speaking: false),
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
      email: "learner@zoonk.test",
      id: "summary-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
