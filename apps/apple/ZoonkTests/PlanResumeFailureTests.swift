import SwiftUI
import XCTest

@testable import Zoonk

/// PR comment 29: a paused goal's Resume on the Plan is the visit's. A failure shown before the
/// learner left is gone when they come back, and one that lands after they left says nothing.
@MainActor
final class PlanResumeFailureTests: XCTestCase {
  func testAResumeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let api = PlanAPIStub()
    await api.setStatusFails(true)
    let tabs = Tabs()
    let window = try await showPlan(api: api, tabs: tabs)

    try await activate(String(localized: "Resume", table: "Plan"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      spoken(in: window).contains(Self.failure)
    }
    XCTAssertTrue(
      spoken(in: window).contains(Self.failure), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(
      spoken(in: window).contains(Self.failure), "Nothing of it on return: \(spoken(in: window))")
  }

  func testAResumeThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let api = PlanAPIStub()
    await api.setStatusFails(true)
    await api.hold(.setStatus)
    let tabs = Tabs()
    let window = try await showPlan(api: api, tabs: tabs)

    try await activate(String(localized: "Resume", table: "Plan"), in: window)
    try await api.waitForHeldCall()
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && spoken(in: window).contains("Elsewhere")
    }
    await api.releaseHeldCall()
    try await api.waitForCompleted(.setStatus)
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && spoken(in: window).contains("Your plan")
    }
    try await waitForTestCondition("Expected state did not arrive") {
      !(spoken(in: window).contains(Self.failure))
    }
    XCTAssertFalse(
      spoken(in: window).contains(Self.failure), "Nothing of it on return: \(spoken(in: window))")
  }

  private static let failure = String(localized: "That didn't save. Try again.", table: "Plan")

  private func leaveAndComeBack(_ tabs: Tabs, in window: UIWindow) async throws {
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && spoken(in: window).contains("Elsewhere")
    }
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && spoken(in: window).contains("Your plan")
    }
  }

  private func showPlan(api: PlanAPIStub, tabs: Tabs) async throws -> UIWindow {
    try await readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      PausedPlan(tabs: tabs)
        .environment(PlanStore(api: api, cache: AppCache(session: session)))
        .environment(session)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    return window
  }

}

@MainActor
@Observable
private final class Tabs {
  var selected = 0
  var pageVisible = false
}

/// A paused goal's Plan in one tab, and somewhere else to go.
private struct PausedPlan: View {
  @Bindable var tabs: Tabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        List {
          Text(verbatim: "Your plan")
        }
        .resumeGoalBar()
        .modifier(GoalOptionsToolbar(goal: Self.goal))
        .onAppear { tabs.pageVisible = true }
        .onDisappear { tabs.pageVisible = false }
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }

  private static let goal = LearnerGoal(
    dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .paused,
    targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM")
}
