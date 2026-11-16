import SwiftUI
import XCTest

@testable import Zoonk

/// PR comment 33: "Add to my plan" waiting for its numbers belongs to the suggestion's opening. Put
/// off, paged past or its sheet closed, the answer arrives and nothing is added; shown through a
/// resize, it adds once.
@MainActor
final class PlanSlotOpeningTests: XCTestCase {
  func testNotNowDropsAnAddStillWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try activate(String(localized: "Not now", table: "Plan"), in: window)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "Put off, the offer adds nothing")
  }

  func testPagingPastDropsAnAddStillWaiting() async throws {
    let api = try await waitingAdd(tooTight: true)
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.more, in: window)
    try await settle()
    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try activate(Self.more, in: window)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "Paged past, the offer adds nothing")
  }

  func testClosingTheSheetDropsAnAddStillWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .narrow)

    try activate(String(localized: "View", table: "Plan"), in: window)
    try await settle()
    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try close(in: window)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "Its sheet closed, the offer adds nothing")
  }

  /// The sheet stays open while the window turns wide: the answer adds the lessons, once.
  func testAnAddStillShownThroughAResizeAddsOnce() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .narrow)

    try activate(String(localized: "View", table: "Plan"), in: window)
    try await settle()
    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    window.frame = Width.wide.frame
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "The offer adds once")
  }

  private static let add = String(localized: "Add to my plan", table: "Plan")
  /// The pager, with one other suggestion.
  private static let more = String(localized: "\(1) more", table: "Plan")

  private enum Width {
    case narrow
    case wide

    var frame: CGRect {
      switch self {
      case .narrow: CGRect(x: 0, y: 0, width: 420, height: 912)
      case .wide: CGRect(x: 0, y: 0, width: 1376, height: 1032)
      }
    }
  }

  /// A plan offering 6 more lessons, whose check today finds the same 6 once it's let through.
  private func waitingAdd(tooTight: Bool = false) async throws -> PlanAPIStub {
    let offer = """
      {"canApply":false,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
       "operations":[{"kind":"addLessons","count":6}]}
      """
    let api = PlanAPIStub()
    await api.setPlan(
      try goalPlanFixture(status: tooTight ? "needsAdjusting" : "onTrack", fitOffer: offer))
    await api.setPreview(
      PlanChangePreview(
        effect: try JSONDecoder().decode(GoalPlan.FitOffer.self, from: Data(offer.utf8)).effect,
        feasibility: nil, finishDate: nil, ready: true, unchanged: false))
    await api.hold(.preview)
    return api
  }

  /// The sheet's close button, the system's: a bar button VoiceOver's activation may not reach from a
  /// hosted window, so its tap is sent when that doesn't act.
  private func close(in window: UIWindow) throws {
    let buttons = views(UIView.self, in: window).filter { $0.accessibilityLabel == "Close" }

    if buttons.contains(where: { $0.accessibilityActivate() }) {
      return
    }

    let control = try XCTUnwrap(
      buttons.compactMap { $0 as? UIControl }.first
        ?? buttons.lazy.compactMap { self.views(UIControl.self, in: $0).first }.first,
      "No close button: \(spoken(in: window))")
    control.sendActions(for: .touchUpInside)
  }

  private func views<Kind: UIView>(_ kind: Kind.Type, in view: UIView) -> [Kind] {
    ((view as? Kind).map { [$0] } ?? []) + view.subviews.flatMap { views(kind, in: $0) }
  }

  /// The held check answers, and the Plan settles.
  private func answer(_ api: PlanAPIStub) async throws {
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    try await settle()
  }

  private func showPlan(api: PlanAPIStub, width: Width) async throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneLearnGoal())
    await dependencies.learnerSummaryStore.summary.load()
    let window = try show(
      NavigationStack {
        PlanScreen()
      }
      .environment(PlanStore(api: api, cache: dependencies.cache))
      .appDependencies(dependencies)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = width.frame
    try await settle()
    try await settle()
    return window
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(400))
  }
}

/// One goal, "goal", whose Plan shows.
private struct OneLearnGoal: LearnerSummaryAPIClient {
  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: "goal",
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil,
      goals: [
        LearnerGoal(
          dailyMinutes: 30, id: "goal", kind: .learn, language: "en", status: .active,
          targetDate: nil, displayName: "Finance", title: "Finance")
      ],
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
