import SwiftUI
import XCTest

@testable import Zoonk

/// "Start with your goal": how adding material ended is the entry page's visit's. The draft page
/// pushed over the entry ends it, so a failure shown before is gone when the learner comes back to
/// the entry; what they typed stays (review of `697b994fb2`).
@MainActor
final class GoalStartVisitTests: XCTestCase {
  func testAMaterialFailureIsGoneOnceTheDraftPageCoveredTheEntry() async throws {
    let server = PageServer(holding: "createGoalUnderstanding")
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: NoGoalSummary())
    await dependencies.learnerSummaryStore.summary.load()
    try await readsWhatVoiceOverReads()
    let window = try show(
      GoalStartScreen(goal: "Pass the ENEM")
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try await activate(String(localized: "Add your material", table: "Onboarding"), in: window)
    try await pick(String(localized: "Paste a link", table: "Onboarding"), in: window)
    var link: UITextField?
    try await waitForTestCondition("The link field did not appear") {
      link = requestViews(UITextField.self, in: window).first
      return link != nil
    }
    link?.text = "https://zoonk.invalid/syllabus"
    link?.sendActions(for: .editingChanged)
    try await activate(String(localized: "Add link", table: "Onboarding"), in: window)
    try await waitForTestCondition("The failure never showed: \(spoken(in: window))") {
      shows(Self.failure, in: window)
    }
    XCTAssertTrue(shows(Self.failure, in: window), "The failure shows: \(spoken(in: window))")

    try await activate(Self.entry, in: window)
    try await server.waitForHeldRequest()
    try await waitForTestCondition("The draft page never covered the entry: \(spoken(in: window))")
    {
      shows(Self.draft, in: window) && !shows(Self.entry, in: window)
    }
    try await server.release()
    try await waitForTestCondition("The entry never came back: \(spoken(in: window))") {
      shows(Self.entry, in: window) && !shows(Self.draft, in: window)
    }
    XCTAssertFalse(shows(Self.failure, in: window), "Gone on return: \(spoken(in: window))")
  }

  private static let failure = String(
    localized: "We couldn't add that. Try again in a moment.", table: "Onboarding")
  private static let entry = String(localized: "Build my plan", table: "Onboarding")
  private static let draft = String(localized: "Understanding your goal", table: "Onboarding")

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(line) }
  }

}

/// A signed-in learner with no goal yet, who can add material.
private struct NoGoalSummary: LearnerSummaryAPIClient {
  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: nil,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil, nextChangeAt: .distantFuture,
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: false, mindMaps: false,
        readyMistakes: 0, speaking: false),
      readAt: .now, tier: .free, timeZone: "America/Sao_Paulo", todayBlocksLeft: nil)
  }

  func switchGoal(token: String, goalID: String) async throws {}

  func setTargetRegion(token: String, goalID: String, region: String?) async throws -> Bool {
    true
  }

  func setContentCountry(token: String, goalID: String, country: String?) async throws
    -> ContentCountryChange
  {
    .notOffered
  }

  func retryRebuild(token: String, goalID: String) async throws {}
}
