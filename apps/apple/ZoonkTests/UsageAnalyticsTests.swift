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

  private func summary(sharing: Bool?) -> LearnerSummary {
    LearnerSummary(
      activeGoalID: nil,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "plus", planPhase: nil, usageDataSharing: sharing,
        username: nil),
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .plus,
      timeZone: nil,
      todayBlocksLeft: nil)
  }
}
