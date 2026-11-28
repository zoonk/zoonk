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
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: false, mindMaps: false,
        readyMistakes: 0, savedLessons: false, speaking: false),
      readAt: .now,
      tier: .plus,
      timeZone: nil,
      todayBlocksLeft: nil)
  }

  func testEachSittingsFirstQuestionIsSentOnceAndResumesOnlyWhatThisVisitDidntStart() {
    let context = AnalyticsEvent.TestContext(goalID: "g1", test: .course, surface: .plan)
    var visit = TestVisit()

    XCTAssertEqual(
      visit.firstQuestion(context, number: 4, sitting: "a1:1")?.properties["resumed"] as? Bool,
      true, "A sitting opened before this visit")
    XCTAssertNil(visit.firstQuestion(context, number: 5, sitting: "a1:1"))

    visit.started()
    let next = visit.firstQuestion(context, number: 1, sitting: "a1:2")
    XCTAssertEqual(next?.properties["resumed"] as? Bool, false, "Keep going started part 2")
    XCTAssertEqual(next?.properties["question_number"] as? Int, 1)
  }
}
