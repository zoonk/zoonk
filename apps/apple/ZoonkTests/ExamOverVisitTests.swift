import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class ExamOverVisitTests: XCTestCase {
  func testKeepStudyingFailureEndsWithTheVisit() async throws {
    let api = PlanAPIStub()
    await api.setChangeError(APIError.network)
    let tabs = Tabs()
    let window = try showPlan(api: api, tabs: tabs)
    try await settle()
    try activate(String(localized: "Keep studying", table: "Plan"), in: window)
    try await settle()
    XCTAssertTrue(spoken(in: window).contains(Self.failure))
    try await leaveAndComeBack(tabs)
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  func testKeepStudyingCompletesAfterLeaving() async throws {
    let api = PlanAPIStub()
    await api.hold(.change)
    let tabs = Tabs()
    let window = try showPlan(api: api, tabs: tabs)
    try await settle()
    try activate(String(localized: "Keep studying", table: "Plan"), in: window)
    await api.waitForHeldCall()
    tabs.selected = 1
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    let calls = await api.calls
    XCTAssertEqual(calls.changes.count, 1)
    tabs.selected = 0
    try await settle()
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  func testArchiveFailureEndsWithTheVisit() async throws {
    let api = PlanAPIStub()
    await api.setStatusFails(true)
    let tabs = Tabs()
    let window = try showPlan(api: api, tabs: tabs)
    try await settle()
    try await archive(in: window)
    try await settle()
    try await settle()
    let calls = await api.calls
    XCTAssertEqual(calls.statuses, [.archived])
    XCTAssertTrue(spoken(in: window).contains(Self.failure), "Shown: \(spoken(in: window))")
    try await leaveAndComeBack(tabs)
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  func testArchiveCompletesAfterLeaving() async throws {
    let api = PlanAPIStub()
    await api.hold(.setStatus)
    let tabs = Tabs()
    let window = try showPlan(api: api, tabs: tabs)
    try await settle()
    try await archive(in: window)
    await api.waitForHeldCall()
    tabs.selected = 1
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    let calls = await api.calls
    XCTAssertEqual(calls.statuses, [.archived])
    tabs.selected = 0
    try await settle()
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  private func archive(in window: UIWindow) async throws {
    try activate(String(localized: "Archive goal", table: "Plan"), in: window)
    try await settle()
    try activate(String(localized: "Archive", table: "Plan"), in: window)
  }

  private static let failure = String(localized: "That didn't save. Try again.", table: "Plan")

  private func leaveAndComeBack(_ tabs: Tabs) async throws {
    tabs.selected = 1
    try await settle()
    tabs.selected = 0
    try await settle()
  }

  private func showPlan(api: PlanAPIStub, tabs: Tabs) throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      PastDatePlan(tabs: tabs)
        .environment(PlanStore(api: api, cache: AppCache(session: session)))
        .environment(session)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    return window
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(400))
  }
}

@MainActor
@Observable
private final class Tabs {
  var selected = 0
}

private struct PastDatePlan: View {
  @Bindable var tabs: Tabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        List {
          Text(verbatim: "Your plan")
        }
        .examOverBar(goal: Self.goal, isShown: true)
        .modifier(GoalOptionsToolbar(goal: Self.goal))
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }

  private static let goal = LearnerGoal(
    dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
    targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM")
}
