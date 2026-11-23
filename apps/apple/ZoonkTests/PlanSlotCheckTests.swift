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

  /// "See what changes" previews the suggested time under the suggestion's own title and sentence,
  /// as web and Android do, instead of retitling the card with the change's question.
  func testSeeWhatChangesKeepsTheSuggestionsTitleAndSentence() async throws {
    let api = PlanAPIStub()
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    let context = try context(plan: goalPlanFixture(targetDate: "2027-06-01"))
    let suggested = TimeToCover.Suggested(kind: .everything, minutes: 60, split: nil)
    try await readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      List {
        PlanCoverageSlot(
          context: context, suggested: suggested,
          actions: PlanSlotActions(apply: { _ in }, notNow: {}))
      }
      .environment(PlanStore(api: api, cache: AppCache(session: session)))
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try await activate(String(localized: "See what changes", table: "Plan"), in: window)
    try await waitForTestCondition("The card did not preview the suggested time") {
      self.spoken(in: window).contains(String(localized: "Change my plan", table: "Plan"))
    }

    let spoken = spoken(in: window)
    XCTAssertTrue(spoken.contains { $0.contains(PlanCoverageSlot.title(suggested)) }, "\(spoken)")
    XCTAssertTrue(
      spoken.contains { $0.hasPrefix("That's enough to be ready for your exam by") }, "\(spoken)")
    XCTAssertEqual(context.slotCheck(.coverage).asked?.edits, [.dailyMinutes(60)])
  }

  /// On the page a suggestion's answers start with its main one, right after the question, as
  /// web's and Android's do: "See what changes" before "Other options", then "Change my plan"
  /// before "Not now".
  func testTheSuggestedTimeCardLeadsWithItsMainAnswer() async throws {
    let api = PlanAPIStub()
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    let context = try context(plan: goalPlanFixture(targetDate: "2027-06-01"))
    try await readsWhatVoiceOverReads()
    let window = try show(coverageCard(context, api: api))
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try assertOrder(
      String(localized: "See what changes", table: "Plan"),
      before: String(localized: "Other options", table: "Plan"), in: window)

    try await activate(String(localized: "See what changes", table: "Plan"), in: window)
    try await waitForTestCondition("The card did not preview the suggested time") {
      self.spoken(in: window).contains(String(localized: "Change my plan", table: "Plan"))
    }

    try assertOrder(
      String(localized: "Change my plan", table: "Plan"),
      before: String(localized: "Not now", table: "Plan"), in: window)
  }

  /// In the suggestion's sheet its answers end with the main one, as every sheet's bar does.
  func testASuggestionsSheetEndsWithItsMainAnswer() async throws {
    let api = PlanAPIStub()
    await api.setPreview(
      PlanChangePreview(
        effect: try fitOffer().effect, feasibility: nil, finishDate: nil, ready: true,
        unchanged: false))
    let context = try context(plan: goalPlanFixture(targetDate: "2027-06-01"))
    try await readsWhatVoiceOverReads()
    let window = try show(
      coverageCard(context, api: api).environment(\.isInSuggestionSheet, true))
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try assertOrder(
      String(localized: "Other options", table: "Plan"),
      before: String(localized: "See what changes", table: "Plan"), in: window)
  }

  /// The line saying the plan doesn't fit adjusts it with its own "Adjust", as web's and Android's
  /// do, instead of opening the suggestion in a sheet first.
  func testTheLineSayingThePlanDoesNotFitAdjustsItDirectly() async throws {
    var adjusted: [AdjustPlanSheet.Section] = []
    var shown: [PlanSheet] = []
    let context = PlanContext(
      goal: Self.goal(kind: .exam), plan: try goalPlanFixture(status: "needsAdjusting"),
      adjust: { adjusted.append($0) }, show: { shown.append($0) }, slotChecks: PlanSlotChecks())
    try await readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let window = try show(
      List {
        PlanSuggestionSection(context: context, answer: .constant(nil))
      }
      .environment(PlanStore(api: PlanAPIStub(), cache: AppCache(session: session)))
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    XCTAssertFalse(
      spoken(in: window).contains(String(localized: "View", table: "Plan")), "\(spoken(in: window))"
    )
    try await activate(String(localized: "Adjust", table: "Plan"), in: window)

    XCTAssertEqual(adjusted, [.top])
    XCTAssertTrue(shown.isEmpty, "Nothing opens before the plan's settings")
  }

  /// The finished plan's line offers its certificate itself, as web's and Android's do, with
  /// "View" for what to study next; the claim opens nothing first.
  func testTheFinishedPlansLineOffersItsCertificate() async throws {
    var claims = 0
    var shown: [PlanSheet] = []
    let context = PlanContext(
      goal: Self.goal(kind: .learn), plan: try goalPlanFixture(end: "finished"), adjust: { _ in },
      show: { shown.append($0) },
      claimCertificate: {
        claims += 1
        return nil
      }, slotChecks: PlanSlotChecks())
    let window = try await showSuggestion(
      context,
      end: #"""
        {"certificates": {"earned": [], "unclaimed": [{"courseLevel": null}]},
         "next": {"nextLevel": {"level": "intermediate", "title": "Intermediate"}, "related": []}}
        """#)

    XCTAssertTrue(
      spoken(in: window).contains(String(localized: "View", table: "Plan")), "\(spoken(in: window))"
    )
    try await activate(String(localized: "Get your certificate", table: "Plan"), in: window)

    try await waitForTestCondition("The claim was never sent") { claims == 1 }
    XCTAssertTrue(shown.isEmpty, "The claim opens nothing first")
    try await waitForTestCondition("The line never said the claim didn't save") {
      self.spoken(in: window).contains(String(localized: SuggestionSaveError.message))
    }
  }

  /// With nothing more to show, the line is its certificate alone.
  func testTheFinishedPlansLineWithNothingNextIsItsCertificate() async throws {
    let context = try context(kind: .learn, plan: goalPlanFixture(end: "finished"))
    let window = try await showSuggestion(
      context,
      end: #"""
        {"certificates": {"earned": [{"code": "abc", "locked": false}], "unclaimed": []},
         "next": {"nextLevel": null, "related": []}}
        """#)

    let spoken = spoken(in: window)
    XCTAssertTrue(
      spoken.contains(String(localized: "View certificate", table: "Plan")), "\(spoken)")
    XCTAssertFalse(spoken.contains(String(localized: "View", table: "Plan")), "\(spoken)")
  }

  /// Beside the page the finished plan reads as main's panel: what to study next under its title,
  /// "Continue at" before the certificate in one row, and a start that didn't save said under them.
  func testTheFinishedPlansPanelSaysAStartThatDidNotSaveUnderItsButtons() async throws {
    let context = try context(kind: .learn, plan: goalPlanFixture(end: "finished"))
    let window = try await showSuggestion(
      context,
      end: #"""
        {"certificates": {"earned": [], "unclaimed": [{"courseLevel": null}]},
         "next": {"nextLevel": {"level": "intermediate", "title": "Intermediate"}, "related": []}}
        """#, isInline: true)
    let isContinue = { (label: String) in label.hasPrefix("Continue at") }
    let spoken = spoken(in: window)
    let description = try XCTUnwrap(
      spoken.firstIndex(of: String(localized: "Here's what to study next.", table: "Plan")),
      "\(spoken)")
    let start = try XCTUnwrap(spoken.firstIndex(where: isContinue), "\(spoken)")
    let claim = try XCTUnwrap(
      spoken.firstIndex(of: String(localized: "Get your certificate", table: "Plan")), "\(spoken)")
    XCTAssertLessThan(description, start, "\(spoken)")
    XCTAssertLessThan(start, claim, "\(spoken)")

    try await activate(where: isContinue, in: window)

    try await waitForTestCondition("The panel never said the start didn't save") {
      self.spoken(in: window).contains(String(localized: SuggestionSaveError.message))
    }
  }

  // MARK: Helpers

  /// The suggestion in the page's column, or beside the page when `isInline`, with the plan's end
  /// read as `end`.
  private func showSuggestion(_ context: PlanContext, end: String, isInline: Bool = false)
    async throws -> UIWindow
  {
    try await readsWhatVoiceOverReads()
    let session = SessionStore.preview(account: .planTestAccount)
    let api = PlanAPIStub()
    await api.setPlanEnd(try JSONDecoder().decode(PlanEnd.self, from: Data(end.utf8)))
    let store = PlanStore(api: api, cache: AppCache(session: session))
    await store.planEnd(goalId: context.goal.id).load()
    let window = try show(
      List {
        PlanSuggestionSection(context: context, answer: .constant(nil), isInline: isInline)
      }
      .environment(store)
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)
    return window
  }

  private func context(kind: LearnerGoal.Kind = .exam, plan: GoalPlan? = nil) throws
    -> PlanContext
  {
    PlanContext(
      goal: Self.goal(kind: kind), plan: try plan ?? goalPlanFixture(), adjust: { _ in },
      show: { _ in }, slotChecks: PlanSlotChecks())
  }

  private static func goal(kind: LearnerGoal.Kind) -> LearnerGoal {
    LearnerGoal(
      dailyMinutes: 30, id: "goal", kind: kind, language: "en", status: .active,
      targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM")
  }

  /// The exam's suggested time card, 1 hr a day covering everything by its date.
  private func coverageCard(_ context: PlanContext, api: PlanAPIStub) -> some View {
    let session = SessionStore.preview(account: .planTestAccount)

    return List {
      PlanCoverageSlot(
        context: context, suggested: .init(kind: .everything, minutes: 60, split: nil),
        actions: PlanSlotActions(apply: { _ in }, notNow: {}))
    }
    .environment(PlanStore(api: api, cache: AppCache(session: session)))
    .environment(session)
    .environment(AppRouter())
    .zoonkStyles()
  }

  /// `first` comes before `second` in the order VoiceOver reads, which is the row's.
  private func assertOrder(
    _ first: String, before second: String, in window: UIWindow,
    file: StaticString = #filePath, line: UInt = #line
  ) throws {
    let spoken = spoken(in: window)
    let firstIndex = try XCTUnwrap(
      spoken.firstIndex(of: first), "\(spoken)", file: file, line: line)
    let secondIndex = try XCTUnwrap(
      spoken.firstIndex(of: second), "\(spoken)", file: file, line: line)
    XCTAssertLessThan(firstIndex, secondIndex, "\(spoken)", file: file, line: line)
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
