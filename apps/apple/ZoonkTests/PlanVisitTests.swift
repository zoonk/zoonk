import SwiftUI
import XCTest

@testable import Zoonk

/// PR comment 29 on the Plan: "Continue at" the next level, "I can already read it" and a rebuild's
/// "Try again" belong to the visit that asked. A failure shown before the learner left is gone when
/// they come back, and one that lands after they left says nothing.
@MainActor
final class PlanVisitTests: XCTestCase {
  func testANextLevelThatDidntStartIsGoneOnReturn() async throws {
    let api = try await finishedPlan()
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: api, goal: Self.goal(), tabs: tabs, wide: true)

    try await activate(where: { $0.hasPrefix(Self.continueAt) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntWork, in: window)
    }
    XCTAssertTrue(shows(Self.didntWork, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntWork, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testANextLevelThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = try await finishedPlan()
    await api.hold(.continueAtNextLevel)
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: api, goal: Self.goal(), tabs: tabs, wide: true)

    try await activate(where: { $0.hasPrefix(Self.continueAt) }, in: window)
    try await api.waitForHeldCall()
    try await leave(tabs, in: window, meanwhile: { await api.releaseHeldCall() })

    XCTAssertFalse(shows(Self.didntWork, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testAnAlphabetSkipThatDidntWorkIsGoneOnReturn() async throws {
    let api = try await languagePlan()
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: api, goal: Self.goal(kind: .language), tabs: tabs)

    try await activate(String(localized: "I can already read it", table: "Plan"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntWork, in: window)
    }
    XCTAssertTrue(shows(Self.didntWork, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntWork, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAnAlphabetSkipThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = try await languagePlan()
    await api.hold(.skipAlphabet)
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: api, goal: Self.goal(kind: .language), tabs: tabs)

    try await activate(String(localized: "I can already read it", table: "Plan"), in: window)
    try await api.waitForHeldCall()
    try await leave(tabs, in: window, meanwhile: { await api.releaseHeldCall() })

    XCTAssertFalse(shows(Self.didntWork, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testARebuildRetryThatDidntSaveIsGoneOnReturn() async throws {
    let summary = RebuildSummary(goal: Self.goal(rebuild: .failed))
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: PlanAPIStub(), summary: summary, tabs: tabs)

    try await activate(String(localized: "Try again", table: "Plan"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testARebuildRetryThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let summary = RebuildSummary(goal: Self.goal(rebuild: .failed))
    await summary.holdRetry()
    let tabs = PlanVisitTabs()
    let window = try await showPlan(api: PlanAPIStub(), summary: summary, tabs: tabs)

    try await activate(String(localized: "Try again", table: "Plan"), in: window)
    await summary.waitForHeldRetry()
    try await leave(tabs, in: window, meanwhile: { await summary.releaseRetry() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  private static let didntWork = String(
    localized: "That didn't work. Try again in a moment.", table: "Plan")
  private static let didntSave = String(localized: "That didn't save. Try again.", table: "Plan")
  private static let continueAt = String(localized: "Continue at \("")", table: "Plan")

  private static func goal(
    kind: LearnerGoal.Kind = .learn, rebuild: ContentCountry.Rebuild? = nil
  ) -> LearnerGoal {
    var goal = LearnerGoal(
      dailyMinutes: 30, id: "goal", kind: kind, language: "en", status: .active,
      targetDate: nil, displayName: "Finance", title: "Finance")
    goal.contentCountry = rebuild.map {
      ContentCountry(
        code: "BR", name: "Brazil", kind: .content, editable: true, source: .said,
        lessonVariety: nil, rebuild: $0)
    }
    return goal
  }

  /// A finished plan whose next level the learner can continue at; starting it fails.
  private func finishedPlan() async throws -> PlanAPIStub {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(end: "finished"))
    await api.setPlanEnd(
      try JSONDecoder().decode(
        PlanEnd.self,
        from: Data(
          #"""
          {"certificates": null,
           "next": {"nextLevel": {"level": "intermediate", "title": "Finance"}, "related": []}}
          """#.utf8)))
    return api
  }

  /// A language plan whose alphabet lesson is still ahead; skipping it fails.
  private func languagePlan() async throws -> PlanAPIStub {
    let api = PlanAPIStub()
    await api.setLanguageUnits(
      try JSONDecoder().decode(
        LanguageUnitsOverview.self,
        from: Data(
          #"""
          {"alphabet": {"lessonId": "alphabet", "minutes": 10, "pending": true,
           "title": "The alphabet"}}
          """#.utf8)))
    return api
  }

  /// Wide, the finished plan's card is drawn whole beside the path rather than as a row to open.
  private func showPlan(
    api: PlanAPIStub, goal: LearnerGoal, tabs: PlanVisitTabs, wide: Bool = false
  ) async throws -> UIWindow {
    try await showPlan(api: api, summary: RebuildSummary(goal: goal), tabs: tabs, wide: wide)
  }

  private func showPlan(
    api: PlanAPIStub, summary: RebuildSummary, tabs: PlanVisitTabs, wide: Bool = false
  ) async throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: summary)
    await dependencies.learnerSummaryStore.summary.load()
    let window = try show(
      PlanVisitTabsView(tabs: tabs)
        .environment(PlanStore(api: api, cache: dependencies.cache))
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame =
      wide
      ? CGRect(x: 0, y: 0, width: 1376, height: 1032) : CGRect(x: 0, y: 0, width: 420, height: 912)
    return window
  }

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(line) }
  }

  private func leaveAndComeBack(_ tabs: PlanVisitTabs, in window: UIWindow) async throws {
    try await leave(tabs, in: window, meanwhile: {})
  }

  /// Goes to the other tab, lets `meanwhile` happen there, and comes back.
  private func leave(_ tabs: PlanVisitTabs, in window: UIWindow, meanwhile: () async -> Void)
    async throws
  {
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && spoken(in: window).contains("Elsewhere")
    }
    await meanwhile()
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && !spoken(in: window).contains("Elsewhere")
    }
  }

}

@MainActor
@Observable
private final class PlanVisitTabs {
  var selected = 0
  var pageVisible = false
}

/// The Plan in one tab, and somewhere else to go.
private struct PlanVisitTabsView: View {
  @Bindable var tabs: PlanVisitTabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        PlanScreen()
          .onAppear { tabs.pageVisible = true }
          .onDisappear { tabs.pageVisible = false }
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }
}

/// One goal; starting its plan again fails, after it's released when held.
private actor RebuildSummary: LearnerSummaryAPIClient {
  private let goal: LearnerGoal
  private var holds = false
  private var held: TestContinuation<Void>?
  private var completed = 0
  private var heldWaiter: TestContinuation<Void>?

  init(goal: LearnerGoal) {
    self.goal = goal
  }

  func holdRetry() { holds = true }

  func waitForHeldRetry(file: StaticString = #filePath, line: UInt = #line) async {
    guard held == nil else {
      return
    }

    await withTestVoidContinuation(file: file, line: line) { heldWaiter = $0 }
  }

  func releaseRetry(file: StaticString = #filePath, line: UInt = #line) async {
    let before = completed
    held?.resume()
    held = nil
    _ = try? await waitForTestCondition(
      "The released response did not finish", file: file, line: line
    ) { await self.completed > before }
  }

  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: goal.id,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil,
      goals: [goal],
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

  func retryRebuild(token: String, goalID: String) async throws {
    defer { completed += 1 }
    if holds {
      holds = false
      await withTestVoidContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    throw APIError.unavailable
  }
}
