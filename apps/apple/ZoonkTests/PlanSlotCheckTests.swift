import SwiftUI
import XCTest

@testable import Zoonk

/// A suggestion card's check, started and then crossed by the width where the Plan splits into two
/// panes or joins them: the card is drawn again on the other side, and the check goes on and shows.
@MainActor
final class PlanSlotCheckTests: XCTestCase {
  func testAddToMyPlanAppliesWhenThePlanJoinsItsPanes() async throws {
    try await addsAcross(from: .wide, to: .narrow)
  }

  func testAddToMyPlanAppliesWhenThePlanSplitsIntoPanes() async throws {
    try await addsAcross(from: .narrow, to: .wide)
  }

  func testSeeWhatChangesShowsItsChangeWhenThePlanJoinsItsPanes() async throws {
    try await previewsAcross(from: .wide, to: .narrow)
  }

  func testSeeWhatChangesShowsItsChangeWhenThePlanSplitsIntoPanes() async throws {
    try await previewsAcross(from: .narrow, to: .wide)
  }

  func testFindADateSaysWhatItFoundWhenThePlanJoinsItsPanes() async throws {
    try await findsDateAcross(from: .wide, to: .narrow)
  }

  func testFindADateSaysWhatItFoundWhenThePlanSplitsIntoPanes() async throws {
    try await findsDateAcross(from: .narrow, to: .wide)
  }

  /// Leaving the Plan ends the visit: what a card's check found or failed at shows nothing on the
  /// next one.
  func testLeavingThePlanShowsNothingOfACardsCheck() {
    let checks = PlanSlotChecks()
    let check = checks.check(.fitLessons, goalId: "goal")
    check.failed = true

    checks.leave()

    XCTAssertFalse(checks.check(.fitLessons, goalId: "goal").failed)
  }

  // MARK: Each card

  private func addsAcross(from: Width, to: Width) async throws {
    let api = PlanAPIStub()
    let offer = try fitOffer()
    await api.setPreview(
      PlanChangePreview(
        effect: offer.effect, feasibility: nil, finishDate: nil, ready: true, unchanged: false))
    await api.hold(.preview)
    var applied: [[PlanEdit]] = []
    let context = try context()
    let actions = PlanSlotActions(apply: { applied.append($0) }, notNow: {})

    try await across(from: from, to: to, tap: "Add to my plan", api: api) {
      PlanFitSlot(context: context, offer: offer, title: Text(verbatim: "Fit"), actions: actions)
    }

    XCTAssertEqual(applied.count, 1, "Add to my plan applies once")
  }

  private func previewsAcross(from: Width, to: Width) async throws {
    let api = PlanAPIStub()
    await api.setSuggested(
      TimeToCover.Suggested(
        coveredShare: 1, everyTopic: true, kind: .everything, minutes: 60, split: nil))
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    await api.hold(.preview)
    let context = try context()

    let window = try await across(from: from, to: to, tap: "See what changes", api: api) {
      PlanCoverageSlot(
        context: context, title: "Coverage", asksAtOnce: false,
        actions: PlanSlotActions(apply: { _ in }, notNow: {}))
    }

    XCTAssertNotNil(
      context.slotChecks.check(.coverage("Coverage"), goalId: "goal").asked, "The change it found")
    XCTAssertTrue(
      spoken(in: window).contains(String(localized: "Change my plan", table: "Plan")),
      "The card shows the change: \(spoken(in: window))")
  }

  private func findsDateAcross(from: Width, to: Width) async throws {
    let api = PlanAPIStub()
    await api.hold(.timeToCover)
    let context = try context()

    let window = try await across(from: from, to: to, tap: "Find a date", api: api) {
      PlanPastDateSlot(context: context, actions: PlanSlotActions(apply: { _ in }, notNow: {}))
    }

    let found = String(localized: "No date fits all your lessons.", table: "Plan")
    XCTAssertTrue(
      spoken(in: window).contains { $0.contains(found) },
      "The card says what it found: \(spoken(in: window))")
  }

  // MARK: Helpers

  private enum Width: CGFloat {
    case narrow = 420
    case wide = 1376
  }

  /// The card on both sides of a split, tapped at one width and answered at the other.
  @discardableResult
  private func across(
    from: Width, to: Width, tap: String.LocalizationValue, api: PlanAPIStub,
    @ViewBuilder card: () -> some View
  ) async throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let shown = card()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      PaneSplit {
        Color.clear
      } secondary: {
        List { shown }
      } single: {
        List { shown }
      }
      .environment(PlanStore(api: api, cache: AppCache(session: session)))
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = frame(from)
    try await settle()

    try activate(String(localized: tap, table: "Plan"), in: window)
    await api.waitForHeldCall()

    window.frame = frame(to)
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    return window
  }

  private func frame(_ width: Width) -> CGRect {
    CGRect(x: 0, y: 0, width: width.rawValue, height: width == .wide ? 1032 : 912)
  }

  private func context() throws -> PlanContext {
    PlanContext(
      goal: LearnerGoal(
        dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
        targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM"),
      plan: try goalPlanFixture(), adjust: { _ in }, show: { _ in })
  }

  private func fitOffer() throws -> GoalPlan.FitOffer {
    try JSONDecoder().decode(
      GoalPlan.FitOffer.self,
      from: Data(
        #"""
        {"canApply":true,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
         "operations":[{"kind":"addLessons","count":6}]}
        """#.utf8))
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(300))
  }
}
