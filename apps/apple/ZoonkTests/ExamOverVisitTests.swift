import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class ExamOverVisitTests: XCTestCase {
  func testReturningWhileKeepStudyingSavesDoesNotSendAnotherChange() async throws {
    let api = PlanAPIStub()
    await api.hold(.change)
    let tabs = Tabs()
    let window = try await showPlan(api: api, tabs: tabs)
    try await activate(String(localized: "Keep studying", table: "Plan"), in: window)
    try await api.waitForHeldCall()
    try await leaveAndComeBack(tabs, in: window)
    if spoken(in: window).contains(String(localized: "Keep studying", table: "Plan")) {
      try await activate(String(localized: "Keep studying", table: "Plan"), in: window)
    }
    await api.releaseHeldCall()
    try await waitForTestCondition("The change was not recorded") {
      await api.calls.changes.count == 1
    }
    let calls = await api.calls
    XCTAssertEqual(calls.changes.count, 1)
  }

  func testKeepStudyingFailureEndsWithTheVisit() async throws {
    let api = PlanAPIStub()
    await api.setChangeError(APIError.network)
    let tabs = Tabs()
    let window = try await showPlan(api: api, tabs: tabs)
    try await activate(String(localized: "Keep studying", table: "Plan"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      spoken(in: window).contains(Self.failure)
    }
    XCTAssertTrue(spoken(in: window).contains(Self.failure))
    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  func testKeepStudyingCompletesAfterLeaving() async throws {
    let api = PlanAPIStub()
    await api.hold(.change)
    let tabs = Tabs()
    let window = try await showPlan(api: api, tabs: tabs)
    try await activate(String(localized: "Keep studying", table: "Plan"), in: window)
    try await api.waitForHeldCall()
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && spoken(in: window).contains("Elsewhere")
    }
    await api.releaseHeldCall()
    try await waitForTestCondition("The change was not recorded") {
      await api.calls.changes.count == 1
    }
    let calls = await api.calls
    XCTAssertEqual(calls.changes.count, 1)
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && spoken(in: window).contains("Your plan")
    }
    try await waitForTestCondition("Expected state did not arrive") {
      !(spoken(in: window).contains(Self.failure))
    }
    XCTAssertFalse(spoken(in: window).contains(Self.failure))
  }

  func testArchiveFailureEndsWithTheVisit() async throws {
    let api = PlanAPIStub()
    await api.setStatusFails(true)
    let session = SessionStore.preview(account: .planTestAccount)
    let store = PlanStore(api: api, cache: AppCache(session: session))
    let router = AppRouter()
    let saving = ExamOverSave()

    saving.save(.archive, goalId: "goal", store: store, router: router)
    try await waitForTestCondition("Archive failure did not arrive") {
      saving.request.outcome == true
    }
    let calls = await api.calls
    XCTAssertEqual(calls.statuses, [.archived])
    XCTAssertEqual(saving.request.outcome, true)
    saving.leave()
    XCTAssertNil(saving.request.outcome)
  }

  func testArchiveCompletesAfterLeaving() async throws {
    let api = PlanAPIStub()
    await api.hold(.setStatus)
    let session = SessionStore.preview(account: .planTestAccount)
    let store = PlanStore(api: api, cache: AppCache(session: session))
    let router = AppRouter()
    let saving = ExamOverSave()

    saving.save(.archive, goalId: "goal", store: store, router: router)
    try await api.waitForHeldCall()
    saving.leave()
    await api.releaseHeldCall()
    try await waitForTestCondition("Archive was not recorded") {
      await api.calls.statuses == [.archived]
    }
    let calls = await api.calls
    XCTAssertEqual(calls.statuses, [.archived])
    XCTAssertNil(saving.request.outcome)
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
      PastDatePlan(tabs: tabs)
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
        .onAppear { tabs.pageVisible = true }
        .onDisappear { tabs.pageVisible = false }
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
