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

  /// Review of `a840fd3f5b`: the plan is read again into one whose shown suggestion is another, so
  /// the card that asked is gone though nobody put it off or paged.
  func testARefreshIntoAnotherSuggestionDropsAnAddStillWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    await api.setPlan(try goalPlanFixture(status: "needsAdjusting", fitOffer: Self.offer))
    await api.setChanged(true)
    await plans.plan(goalId: "goal").refresh()
    try await settle()
    XCTAssertTrue(
      spoken(in: window).contains(String(localized: "More lessons than days left", table: "Plan")),
      "Another suggestion shows: \(spoken(in: window))")
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "Its card gone, the offer adds nothing")
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

  /// PR comment 34: "Get your certificate" in the finished plan's sheet, the sheet closed before the
  /// claim answers. Nothing opens then, nor when another of the Plan's sheets closes later.
  func testClosingTheSheetDropsAClaimStillWaiting() async throws {
    let claims = HeldClaims()
    let router = AppRouter()
    let window = try await showPlan(
      api: try await finishedPlan(), width: .narrow, claims: claims, router: router)

    try activate(String(localized: "View", table: "Plan"), in: window)
    try await settle()
    try activate(Self.claim, in: window)
    await claims.waitUntilAsked()
    try close(in: window)
    try await settle()
    await claims.answer()
    try await settle()
    XCTAssertNil(router.sheet, "Nothing opens once its sheet closed")

    try activate(String(localized: "View", table: "Plan"), in: window)
    try await settle()
    try close(in: window)
    try await settle()
    try await settle()
    XCTAssertNil(router.sheet, "Nor when a later sheet closes")
  }

  /// The sheet stays open while the window turns wide: what the claim earned opens, once.
  func testAClaimStillShownThroughAResizeOpensWhatItEarned() async throws {
    let claims = HeldClaims()
    let router = AppRouter()
    let window = try await showPlan(
      api: try await finishedPlan(), width: .narrow, claims: claims, router: router)

    try activate(String(localized: "View", table: "Plan"), in: window)
    try await settle()
    try activate(Self.claim, in: window)
    await claims.waitUntilAsked()
    window.frame = Width.wide.frame
    try await settle()
    await claims.answer()
    try await settle()
    try await settle()

    XCTAssertEqual(router.sheet, .account(.certificates), "The certificates open")
  }

  // MARK: Each field of the opening, both ways (review of `f139772757`)

  /// Not in the opening: a change to the plan the suggestion doesn't depend on, such as Today's Not
  /// now on the Focus test from another window. The claim still opens what it earned.
  func testAnUnrelatedPlanChangeKeepsAClaimWaiting() async throws {
    let claims = HeldClaims()
    let router = AppRouter()
    let api = try await finishedPlan()
    let window = try await showPlan(api: api, width: .wide, claims: claims, router: router)

    try activate(Self.claim, in: window)
    await claims.waitUntilAsked()
    try await dismissFocusTestElsewhere(api)
    await claims.answer()
    try await settle()
    try await settle()

    XCTAssertEqual(router.sheet, .account(.certificates), "What it earned opens")
  }

  /// Not in the opening, for the fit offer: the add lands, once.
  func testAnUnrelatedPlanChangeKeepsAnAddWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try await dismissFocusTestElsewhere(api)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "The offer adds once")
  }

  /// The fit offer is in the opening: another offer for the same suggestion ends what the old one
  /// asked.
  func testAnotherOfferEndsAnAddWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try await readAgain(api, plan: goalPlanFixture(fitOffer: Self.offer(lessons: 4)))
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "The old offer adds nothing")
  }

  /// Found about another offer, the numbers show nothing once the plan offers a new one, and Add
  /// applies the offer shown (PR comment 28, now on the whole Plan).
  func testARepricedAddAboutAnEarlierOfferShowsNothingOnTheNextOne() async throws {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(fitOffer: Self.offer))
    await api.setPreview(try Self.preview(lessons: 3))
    let window = try await showPlan(api: api, width: .wide)
    let repriced = String(
      localized: "Your plan changed since you saw this. Here's what it does now.", table: "Plan")

    try activate(Self.add, in: window)
    try await settle()
    XCTAssertTrue(
      spoken(in: window).contains { $0.contains(repriced) },
      "The check found other numbers: \(spoken(in: window))")

    try await readAgain(api, plan: goalPlanFixture(fitOffer: Self.offer(lessons: 4)))
    XCTAssertFalse(
      spoken(in: window).contains { $0.contains(repriced) },
      "Nothing of the earlier offer's check shows: \(spoken(in: window))")

    await api.setPreview(try Self.preview(lessons: 4))
    try activate(Self.add, in: window)
    try await settle()
    try await settle()
    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "Add applies the offer shown")
  }

  /// A check that found the offer adds nothing hides Add; the next offer has its Add again.
  func testAnUnchangedAddAboutAnEarlierOfferHasItsAddOnTheNextOne() async throws {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(fitOffer: Self.offer))
    await api.setPreview(
      PlanChangePreview(
        effect: nil, feasibility: nil, finishDate: nil, ready: true, unchanged: true))
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    try await settle()
    XCTAssertFalse(spoken(in: window).contains(Self.add), "The check found nothing to add")

    try await readAgain(api, plan: goalPlanFixture(fitOffer: Self.offer(lessons: 4)))
    XCTAssertTrue(spoken(in: window).contains(Self.add), "The next offer has its Add")
  }

  /// In the opening: the Plan's editor. The learner changes the plan by hand, so an add must not
  /// land under the editor.
  func testOpeningThePlansEditorEndsAnAddWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try activate(String(localized: "Adjust plan", table: "Plan"), in: window)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes, [], "Under the editor, the offer adds nothing")
  }

  /// Not in the opening: another sheet over the Plan, such as its schedule, isn't its editor.
  func testAnotherSheetOverThePlanKeepsAnAddWaiting() async throws {
    let api = try await waitingAdd()
    let window = try await showPlan(api: api, width: .wide)

    try activate(Self.add, in: window)
    await api.waitForHeldCall()
    try activate(
      where: { $0.hasPrefix(String(localized: "Schedule", table: "Plan")) }, in: window)
    try await answer(api)

    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "The offer adds once")
  }

  /// The past date's found date is in its opening's schedule: another number of study days ends it,
  /// and nothing applies.
  func testAScheduleChangeEndsAFoundDate() async throws {
    let api = try await pastDate()
    let window = try await showPlan(api: api, width: .wide)

    try activate(String(localized: "Find a date", table: "Plan"), in: window)
    try await settle()
    XCTAssertTrue(shows(Self.changePlan, in: window), "The date found: \(spoken(in: window))")

    try await readAgain(api, plan: goalPlanFixture(status: "pastDate", studyDays: 5))
    XCTAssertFalse(shows(Self.changePlan, in: window), "Gone: \(spoken(in: window))")
    let changes = await api.calls.changes
    XCTAssertEqual(changes, [])
  }

  /// Not in it: the Focus test changing elsewhere keeps the found date, which applies once.
  func testAnUnrelatedPlanChangeKeepsAFoundDate() async throws {
    let api = try await pastDate()
    let window = try await showPlan(api: api, width: .wide)

    try activate(String(localized: "Find a date", table: "Plan"), in: window)
    try await settle()
    try await dismissFocusTestElsewhere(api)
    try activate(Self.changePlan, in: window)
    try await settle()

    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "The found date applies once")
  }

  /// Coverage's "what changes" is in its opening's schedule too, even when the line it shows
  /// doesn't change: other study days end it.
  func testAScheduleChangeEndsCoveragesPreview() async throws {
    let api = try await coverage()
    let window = try await showPlan(api: api, width: .wide)

    try activate(String(localized: "See what changes", table: "Plan"), in: window)
    try await settle()
    XCTAssertTrue(shows(Self.changePlan, in: window), "What changes: \(spoken(in: window))")

    try await readAgain(
      api, plan: goalPlanFixture(targetDate: "2027-06-01", feasibility: Self.short, studyDays: 5))
    XCTAssertFalse(shows(Self.changePlan, in: window), "Gone: \(spoken(in: window))")
    let changes = await api.calls.changes
    XCTAssertEqual(changes, [])
  }

  /// Not in it: the Focus test changing elsewhere keeps the preview, which applies once.
  func testAnUnrelatedPlanChangeKeepsCoveragesPreview() async throws {
    let api = try await coverage()
    let window = try await showPlan(api: api, width: .wide)

    try activate(String(localized: "See what changes", table: "Plan"), in: window)
    try await settle()
    try await dismissFocusTestElsewhere(api)
    try activate(Self.changePlan, in: window)
    try await settle()

    let changes = await api.calls.changes
    XCTAssertEqual(changes.count, 1, "The preview applies once")
  }

  func testANewDayEndsAFoundDate() async throws {
    try await foundDateEnds(today: "2027-01-05")
  }

  func testALessonFinishedElsewhereEndsAFoundDate() async throws {
    try await foundDateEnds(lessonsStudied: 1)
  }

  func testANewDayEndsCoveragesPreview() async throws {
    try await coveragePreviewEnds(today: "2027-01-05")
  }

  func testALessonFinishedElsewhereEndsCoveragesPreview() async throws {
    try await coveragePreviewEnds(lessonsStudied: 1)
  }

  private func foundDateEnds(today: String = "2027-01-04", lessonsStudied: Int = 0) async throws {
    let api = try await pastDate()
    let window = try await showPlan(api: api, width: .wide)
    try activate(String(localized: "Find a date", table: "Plan"), in: window)
    try await settle()
    XCTAssertTrue(shows(Self.changePlan, in: window), "The date found")

    try await readAgain(
      api, plan: goalPlanFixture(status: "pastDate", today: today, lessonsStudied: lessonsStudied))
    XCTAssertFalse(shows(Self.changePlan, in: window), "The old date cannot be applied")
    XCTAssertTrue(shows(String(localized: "Find a date", table: "Plan"), in: window))
    let changes = await api.calls.changes
    XCTAssertEqual(changes, [])
  }

  private func coveragePreviewEnds(today: String = "2027-01-04", lessonsStudied: Int = 0)
    async throws
  {
    let api = try await coverage()
    let window = try await showPlan(api: api, width: .wide)
    try activate(String(localized: "See what changes", table: "Plan"), in: window)
    try await settle()
    XCTAssertTrue(shows(Self.changePlan, in: window), "The preview found")

    try await readAgain(
      api,
      plan: goalPlanFixture(
        targetDate: "2027-06-01", feasibility: Self.short, today: today,
        lessonsStudied: lessonsStudied))
    XCTAssertFalse(shows(Self.changePlan, in: window), "The old preview cannot be applied")
    XCTAssertTrue(shows(String(localized: "See what changes", table: "Plan"), in: window))
    let changes = await api.calls.changes
    XCTAssertEqual(changes, [])
  }

  private static let changePlan = String(localized: "Change my plan", table: "Plan")
  /// A date the plan's time doesn't cover.
  private static let short = """
    {"coreFits": false, "coveredShare": 0.6, "deadline": "2027-06-01", "deepensMostAsked": false,
     "fits": false, "measure": "goal", "timeCovers": false}
    """

  /// A plan whose date passed; a later one fits.
  private func pastDate() async throws -> PlanAPIStub {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(status: "pastDate"))
    await api.setFittingDate("2027-12-01")
    await api.setPreview(try Self.preview(lessons: 2))
    return api
  }

  /// A plan whose time a day doesn't cover its date; 60 minutes would.
  private func coverage() async throws -> PlanAPIStub {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(targetDate: "2027-06-01", feasibility: Self.short))
    await api.setSuggested(
      TimeToCover.Suggested(
        coveredShare: 1, everyTopic: true, kind: .everything, minutes: 60, split: nil))
    await api.setPreview(try Self.preview(lessons: 2))
    return api
  }

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains(line)
  }

  private static let claim = String(localized: "Get your certificate", table: "Plan")
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

  private static let offer = """
    {"canApply":false,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
     "operations":[{"kind":"addLessons","count":6}]}
    """

  /// The store the shown Plan reads.
  private var plans: PlanStore!

  /// A plan offering 6 more lessons, whose check today finds the same 6 once it's let through.
  private func waitingAdd(tooTight: Bool = false) async throws -> PlanAPIStub {
    let offer = Self.offer
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

  /// Today's Not now on the Focus test, as another window says it: the shared plan's Focus test
  /// changes, and nothing the suggestion shows does.
  private func dismissFocusTestElsewhere(_ api: PlanAPIStub) async throws {
    await api.setSavedFocusTest(
      try JSONDecoder().decode(
        FocusTestSummary.self,
        from: Data(
          #"{"offer":null,"sessionQuestions":"paused","state":"sitting","suggestsFocus":false}"#
            .utf8)))
    _ = await plans.updateFocusTest(
      goalId: "goal", FocusTestControls(suggestion: .dismissed))
    try await settle()
  }

  /// The plan read again as `plan`.
  private func readAgain(_ api: PlanAPIStub, plan: GoalPlan) async throws {
    await api.setPlan(plan)
    await api.setChanged(true)
    await plans.plan(goalId: "goal").refresh()
    try await settle()
  }

  private static func offer(lessons: Int) -> String {
    """
    {"canApply":false,"effect":{"lessonsAdded":\(lessons),"lessonsRemoved":0},"fits":true,
     "operations":[{"kind":"addLessons","count":\(lessons)}]}
    """
  }

  private static func preview(lessons: Int) throws -> PlanChangePreview {
    PlanChangePreview(
      effect: try JSONDecoder().decode(
        GoalPlan.FitOffer.self, from: Data(offer(lessons: lessons).utf8)
      ).effect,
      feasibility: nil, finishDate: nil, ready: true, unchanged: false)
  }

  /// A finished plan whose certificate the learner hasn't claimed yet.
  private func finishedPlan() async throws -> PlanAPIStub {
    let api = PlanAPIStub()
    await api.setPlan(try goalPlanFixture(end: "finished"))
    await api.setPlanEnd(
      try JSONDecoder().decode(
        PlanEnd.self,
        from: Data(
          #"""
          {"certificates": {"earned": [], "unclaimed": [{"courseLevel": null}]}, "next": null}
          """#.utf8)))
    return api
  }

  /// The held check answers, and the Plan settles.
  private func answer(_ api: PlanAPIStub) async throws {
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    try await settle()
  }

  private func showPlan(
    api: PlanAPIStub, width: Width, claims: HeldClaims? = nil, router: AppRouter = AppRouter()
  ) async throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneLearnGoal())
    await dependencies.learnerSummaryStore.summary.load()
    let certificates = claims.map {
      CertificatesStore(api: $0, cache: dependencies.cache)
    }
    plans = PlanStore(api: api, cache: dependencies.cache)
    let window = try show(
      NavigationStack {
        PlanScreen()
      }
      .environment(plans)
      .environment(certificates ?? dependencies.certificatesStore)
      .appDependencies(dependencies)
      .environment(router)
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

/// A claim that answers when the test says, with two certificates already shown before, so the
/// Plan opens the learner's certificates.
private actor HeldClaims: CertificatesAPIClient {
  private var asked: CheckedContinuation<Void, Never>?
  private var askedWaiter: CheckedContinuation<Void, Never>?

  func waitUntilAsked() async {
    guard asked == nil else {
      return
    }

    await withCheckedContinuation { askedWaiter = $0 }
  }

  func answer() {
    asked?.resume()
    asked = nil
  }

  func claim(token: String, goalID: String) async throws -> [ClaimedCertificate] {
    await withCheckedContinuation { continuation in
      asked = continuation
      askedWaiter?.resume()
      askedWaiter = nil
    }

    return ["COURSE000001", "COURSE000002"].map {
      ClaimedCertificate(
        facts: CertificateFacts(
          code: $0, kind: .course, recipientName: "Ana Souza", completedOn: "2026-11-03",
          title: "Finance", courseLevel: nil, targetLanguage: nil, level: nil, topics: [],
          canDo: [], lessonsStudied: 10, lessonsTestedOut: 0, minutes: 120, locked: false),
        wasShown: true)
    }
  }

  func list(token: String) async throws -> [OwnedCertificate] { [] }
  func markShown(token: String, code: String) async throws {}
  func upNext(token: String) async throws -> [CertificateUpNext] { [] }
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
