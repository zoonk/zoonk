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
  func testLeavingThePlanShowsNothingOfACardsCheck() throws {
    let context = try context()
    context.slotCheck(.fitLessons).failed = true

    context.slotChecks.leave()

    XCTAssertFalse(context.slotCheck(.fitLessons).failed)
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

    try await across(
      from: from, to: to, tap: "Add to plan", api: api
    ) {
      PlanFitSlot(context: context, offer: offer, title: Text(verbatim: "Fit"), actions: actions)
    } completed: {
      applied.count == 1
    }

    XCTAssertEqual(applied.count, 1, "Add to plan applies once")
  }

  private func previewsAcross(from: Width, to: Width) async throws {
    let api = PlanAPIStub()
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    await api.hold(.preview)
    let context = try context()

    let window = try await across(
      from: from, to: to, tap: "See what changes", api: api
    ) {
      PlanCoverageSlot(
        context: context, suggested: .init(kind: .everything, minutes: 60, split: nil),
        actions: PlanSlotActions(apply: { _ in }, notNow: {}))
    } completed: {
      context.slotCheck(.coverage).asked != nil
    }

    XCTAssertNotNil(context.slotCheck(.coverage).asked, "The change it found")
    try await waitForTestCondition("The card did not draw the change") {
      self.spoken(in: window).contains(String(localized: "Change my plan", table: "Plan"))
    }
    XCTAssertTrue(
      spoken(in: window).contains(String(localized: "Change my plan", table: "Plan")),
      "The card shows the change: \(spoken(in: window))")
  }

  private func findsDateAcross(from: Width, to: Width) async throws {
    let api = PlanAPIStub()
    await api.hold(.timeToCover)
    let context = try context()

    let window = try await across(
      from: from, to: to, tap: "Find a date", api: api
    ) {
      PlanPastDateSlot(context: context, actions: PlanSlotActions(apply: { _ in }, notNow: {}))
    } completed: {
      context.slotCheck(.pastDate).noDate
    }

    let found = String(localized: "No date fits all your lessons.", table: "Plan")
    try await waitForTestCondition("The card did not draw the date result") {
      self.spoken(in: window).contains { $0.contains(found) }
    }
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
    @ViewBuilder card: () -> some View, completed: () -> Bool
  ) async throws -> UIWindow {
    try await readsWhatVoiceOverReads()
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
    try await waitForLayout(in: window)
    // The coverage card works out its time as it opens, and its button waits for that.
    let finding = String(localized: "Finding the time that covers everything…", table: "Plan")
    try await waitForTestCondition("The card is still working") {
      !self.spoken(in: window).contains { $0.contains(finding) }
    }

    try await activate(String(localized: tap, table: "Plan"), in: window)
    try await api.waitForHeldCall()

    window.frame = frame(to)
    try await waitForLayout(in: window)
    await api.releaseHeldCall()
    try await waitForTestCondition("The card check did not complete") {
      completed()
    }
    return window
  }

  private func frame(_ width: Width) -> CGRect {
    CGRect(x: 0, y: 0, width: width.rawValue, height: width == .wide ? 1032 : 912)
  }

  /// The Plan's checks are the screen's, so each card drawn from a context shares them.
  private let checks = PlanSlotChecks()

  private func context() throws -> PlanContext {
    PlanContext(
      goal: LearnerGoal(
        dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
        targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM"),
      plan: try goalPlanFixture(), adjust: { _ in }, show: { _ in }, slotChecks: checks)
  }

  private func fitOffer() throws -> GoalPlan.FitOffer {
    try JSONDecoder().decode(
      GoalPlan.FitOffer.self,
      from: Data(
        """
        {"canApply":false,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
         "operations":[{"kind":"addLessons","count":6}]}
        """.utf8))
  }

}
