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
