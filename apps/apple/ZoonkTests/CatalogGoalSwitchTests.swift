import SwiftUI
import XCTest

@testable import Zoonk

/// "Continue your plan" on a course's page while the window crosses the width where the page is two
/// panes: the switch is the page's, so the learner still lands on Today.
@MainActor
final class CatalogGoalSwitchTests: XCTestCase {
  func testContinuingThePlanLandsOnTodayWhenThePageJoinsItsPanes() async throws {
    try await continuesAcross(from: 1376, to: 420)
  }

  func testContinuingThePlanLandsOnTodayWhenThePageSplitsIntoPanes() async throws {
    try await continuesAcross(from: 420, to: 1376)
  }

  private func continuesAcross(from: CGFloat, to: CGFloat) async throws {
    let api = HeldSwitch()
    let session = SessionStore.preview(account: Self.account)
    let learner = LearnerSummaryStore(api: api, cache: AppCache(session: session))
    let router = AppRouter()
    router.select(.plan)
    let goal = LearnerGoal(
      dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
      targetDate: "2027-11-14", displayName: "ENEM", title: "ENEM")
    try readsWhatVoiceOverReads()

    let window = try show(
      PaneSplit {
        CatalogStartActions(courseID: "course", goal: goal, tryLessonID: nil)
      } secondary: {
        Color.clear
      } single: {
        CatalogStartActions(courseID: "course", goal: goal, tryLessonID: nil)
      }
      .catalogGoalSwitch()
      .environment(router)
      .environment(learner)
      .environment(session)
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await settle()

    try activate(String(localized: "Continue your plan", table: "Courses"), in: window)
    await api.waitUntilAsked()
    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await settle()
    await api.release()
    try await settle()

    XCTAssertEqual(router.selectedTab, .today, "Today opens")
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(400))
  }

  private static let account = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "learner", image: nil, name: "Learner", username: nil))
}

/// A goal switch the server answers when the test says.
private actor HeldSwitch: LearnerSummaryAPIClient {
  private var held: CheckedContinuation<Void, Never>?
  private var waiter: CheckedContinuation<Void, Never>?

  func getSummary(token: String) async throws -> LearnerSummary {
    throw APIError.network
  }

  func switchGoal(token: String, goalID: String) async throws {
    await withCheckedContinuation { continuation in
      held = continuation
      waiter?.resume()
      waiter = nil
    }
  }

  func setTargetRegion(token: String, goalID: String, region: String?) async throws -> Bool {
    false
  }

  func setContentCountry(token: String, goalID: String, country: String?) async throws
    -> ContentCountryChange
  {
    throw APIError.network
  }

  func retryRebuild(token: String, goalID: String) async throws {}

  func waitUntilAsked() async {
    if held == nil {
      await withCheckedContinuation { waiter = $0 }
    }
  }

  func release() {
    held?.resume()
    held = nil
  }
}
