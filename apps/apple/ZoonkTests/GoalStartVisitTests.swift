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
      GoalStartScreen()
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try await activate(String(localized: "Add your material", table: "Onboarding"), in: window)
    try await waitForTestCondition("The material menu did not appear") {
      views(UIButton.self, in: window).contains { $0.menu != nil }
    }
    try await activateMenuItem(String(localized: "Paste a link", table: "Onboarding"), in: window)
    try await waitForTestCondition("The link field did not appear") {
      !views(UITextField.self, in: window).isEmpty
    }
    let link = try XCTUnwrap(views(UITextField.self, in: window).first, "The link's box")
    link.becomeFirstResponder()
    link.insertText("https://zoonk.invalid/syllabus")
    try await activate(String(localized: "Add link", table: "Onboarding"), in: window)
    try await waitForTestCondition("The failure never showed: \(spoken(in: window))") {
      shows(Self.failure, in: window)
    }
    XCTAssertTrue(shows(Self.failure, in: window), "The failure shows: \(spoken(in: window))")

    let goal = try XCTUnwrap(views(UITextView.self, in: window).first, "The goal's box")
    goal.becomeFirstResponder()
    goal.insertText("Pass the ENEM")
    try await activate(String(localized: "Build my plan", table: "Onboarding"), in: window)
    try await server.waitForHeldRequest()
    try await server.release()
    try await waitForTestCondition("The entry never came back: \(spoken(in: window))") {
      shows(String(localized: "Build my plan", table: "Onboarding"), in: window)
    }
    XCTAssertTrue(
      shows(String(localized: "Build my plan", table: "Onboarding"), in: window),
      "Back on the entry: \(spoken(in: window))")
    XCTAssertFalse(shows(Self.failure, in: window), "Gone on return: \(spoken(in: window))")
  }

  private static let failure = String(
    localized: "We couldn't add that. Try again in a moment.", table: "Onboarding")

  /// Hosted tests leave hidden windows in the scene. The source menu belongs to this window;
  /// its rows may appear in a separate visible window.
  private func activateMenuItem(_ label: String, in window: UIWindow) async throws {
    try await waitForTestCondition("Nothing runs \(label)") { runMenuItem(label, in: window) }
  }

  private func runMenuItem(_ label: String, in window: UIWindow) -> Bool {
    let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows).filter { !$0.isHidden && $0.alpha > 0 }
    let all = windows.flatMap { views(UIView.self, in: $0) }

    for button in views(UIButton.self, in: window) {
      if let action = button.menu.flatMap({ action(label, in: $0) }) {
        for name in ["performWithSender:target:", "_performActionWithSender:"]
        where action.responds(to: NSSelectorFromString(name)) {
          action.perform(NSSelectorFromString(name), with: nil, with: nil)
          return true
        }
      }
    }

    for list in all.compactMap({ $0 as? UICollectionView }) {
      for cell in list.visibleCells
      where elements(in: cell).contains(where: { $0.accessibilityLabel == label }) {
        if let path = list.indexPath(for: cell) {
          list.delegate?.collectionView?(list, didSelectItemAt: path)
          return true
        }
      }
    }

    return false
  }

  private func action(_ title: String, in menu: UIMenu) -> UIAction? {
    for child in menu.children {
      if let action = child as? UIAction, action.title == title {
        return action
      }

      if let found = (child as? UIMenu).flatMap({ action(title, in: $0) }) {
        return found
      }
    }

    return nil
  }

  private func elements(in element: Any) -> [NSObject] {
    guard let object = element as? NSObject else {
      return []
    }

    if let view = object as? UIView, view.isHidden || view.alpha < 0.01 {
      return []
    }

    return [object] + ((object as? UIView)?.subviews.flatMap { elements(in: $0) } ?? [])
      + (object.accessibilityElements?.flatMap { elements(in: $0) } ?? [])
  }

  private func views<Kind: UIView>(_ kind: Kind.Type, in view: UIView) -> [Kind] {
    ((view as? Kind).map { [$0] } ?? []) + view.subviews.flatMap { views(kind, in: $0) }
  }

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
