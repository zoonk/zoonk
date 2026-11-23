import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class PlanSlotCheckTests: XCTestCase {
  /// Leaving the Plan ends the visit: what a card's check found or failed at shows nothing on the
  /// next one.
  func testLeavingThePlanShowsNothingOfACardsCheck() throws {
    let context = try context()
    context.slotCheck(.fitLessons).failed = true

    context.slotChecks.leave()

    XCTAssertFalse(context.slotCheck(.fitLessons).failed)
  }

  /// "Move your date" finds the day the learner's own time covers everything by, and asks to move
  /// the date there.
  func testMoveYourDatePreviewsTheDayItsOwnTimeCoversEverythingBy() async throws {
    let api = PlanAPIStub()
    await api.setFittingDate("2027-06-01")
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    let context = try context(kind: .learn)
    try await readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      List {
        PlanCoverageSlot(
          context: context, suggested: .init(kind: .everything, minutes: 60, split: nil),
          actions: PlanSlotActions(apply: { _ in }, notNow: {}))
      }
      .environment(PlanStore(api: api, cache: AppCache(session: session)))
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try await activate(String(localized: "Other options", table: "Plan"), in: window)
    try await pick(
      String(localized: "Move your date to cover everything", table: "Plan"), in: window)
    try await waitForTestCondition("The card did not ask to move the date") {
      context.slotCheck(.coverage).asked != nil
    }

    XCTAssertEqual(context.slotCheck(.coverage).asked?.edits, [.targetDate("2027-06-01")])
  }

  // MARK: Helpers

  private func context(kind: LearnerGoal.Kind = .exam) throws -> PlanContext {
    PlanContext(
      goal: LearnerGoal(
        dailyMinutes: 30, id: "goal", kind: kind, language: "en", status: .active,
        targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM"),
      plan: try goalPlanFixture(), adjust: { _ in }, show: { _ in }, slotChecks: PlanSlotChecks())
  }

  private func fitOffer() throws -> GoalPlan.Offer {
    try JSONDecoder().decode(
      GoalPlan.Offer.self,
      from: Data(
        """
        {"canApply":false,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
         "operations":[{"kind":"addLessons","count":6}]}
        """.utf8))
  }
}
