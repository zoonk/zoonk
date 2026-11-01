import XCTest

@testable import Zoonk

final class UsageAnalyticsTests: XCTestCase {
  func testOnlyALoadedLearnerWhoSharesUsageDataIsCounted() throws {
    XCTAssertEqual(consent(summary: nil), .undecided(nil))
    XCTAssertEqual(consent(summary: summary(sharing: nil)), .declined)
    XCTAssertEqual(consent(summary: summary(sharing: false)), .declined)

    guard case .granted(let learner) = consent(summary: summary(sharing: true)) else {
      return XCTFail("a learner who shares is counted")
    }

    XCTAssertEqual(learner.userID, "learner")
  }

  func testSendsMainsPropertiesWithNullsForWhatIsMissing() throws {
    let learner = try XCTUnwrap(
      granted(summary(sharing: true, goalKind: .language, planPhase: 2, username: "ana"), "pt"))
    let guest = try XCTUnwrap(granted(summary(sharing: true, isAnonymous: true), "en"))

    XCTAssertEqual(
      learner.personProperties as NSDictionary,
      ["analyticsDisabled": false, "plan": "plus", "userId": "learner", "username": "ana"])
    XCTAssertEqual(
      learner.sharedProperties as NSDictionary,
      [
        "goal_kind": "language", "is_guest": false, "locale": "pt", "plan_phase": 2,
        "platform": "ios",
      ])
    XCTAssertEqual(guest.personProperties["username"] as? NSNull, NSNull())
    XCTAssertEqual(
      guest.sharedProperties as NSDictionary,
      [
        "goal_kind": NSNull(), "is_guest": true, "locale": "en", "plan_phase": NSNull(),
        "platform": "ios",
      ])
  }

  func testNothingLeavesWhileNoLearnerShares() {
    XCTAssertFalse(UsageDataGate.mayLeave(postHog("batch"), body: batch("ana"), as: []))
    XCTAssertFalse(UsageDataGate.mayLeave(postHog("flags"), body: Data("{}".utf8), as: []))
  }

  func testABatchLeavesOnlyWithTheSharingLearnersEvents() {
    let ana: Set = ["ana", "ana-before-identify"]

    XCTAssertTrue(
      UsageDataGate.mayLeave(postHog("batch"), body: batch("ana-before-identify", "ana"), as: ana))
    XCTAssertFalse(UsageDataGate.mayLeave(postHog("batch"), body: batch("bia", "ana"), as: ana))
  }

  func testOnlyBatchesEverLeave() {
    XCTAssertFalse(UsageDataGate.mayLeave(postHog("flags"), body: Data("{}".utf8), as: ["ana"]))
  }

  /// Events PostHog queued while a learner shared, such as offline, are answered on the device once
  /// they stop.
  func testAQueuedBatchIsRefusedOnTheDeviceAfterTheLearnerStopsSharing() async throws {
    UsageDataGate.share(as: ["ana"])
    UsageDataGate.share(as: [])

    let session = URLSession(configuration: UsageDataGate.sessionConfiguration)
    let (_, response) = try await session.upload(for: postHog("batch"), from: batch("ana"))

    XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 403)
  }

  private func postHog(_ path: String) -> URLRequest {
    var request = URLRequest(url: URL(string: "https://posthog.invalid/\(path)")!)
    request.httpMethod = "POST"
    return request
  }

  private func batch(_ distinctIDs: String...) -> Data {
    let events = distinctIDs.map { #"{"event":"Today Viewed","distinct_id":"\#($0)"}"# }
    return Data(#"{"api_key":"phc","batch":[\#(events.joined(separator: ","))]}"#.utf8)
  }

  private func consent(summary: LearnerSummary?) -> AnalyticsConsent {
    AnalyticsConsent(session: nil, summary: summary, locale: "en")
  }

  private func granted(_ summary: LearnerSummary, _ locale: String) -> AnalyticsLearner? {
    guard
      case .granted(let learner) = AnalyticsConsent(session: nil, summary: summary, locale: locale)
    else {
      return nil
    }

    return learner
  }

  private func summary(
    sharing: Bool?, isAnonymous: Bool = false, goalKind: LearnerGoal.Kind? = nil,
    planPhase: Int? = nil, username: String? = nil
  ) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: nil,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: goalKind, plan: isAnonymous ? "free" : "plus",
        planPhase: planPhase, usageDataSharing: sharing, username: username),
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: isAnonymous, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: isAnonymous ? .guest : .plus,
      timeZone: nil,
      todayBlocksLeft: nil)
  }
}
