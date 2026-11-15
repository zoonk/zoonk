import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class PlanStoreTests: XCTestCase {
  func testPlanIsReadOnceAndNotAgainWhileItHasntChanged() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")

    await plan.load()
    await plan.refresh()
    await plan.refresh()

    let calls = await api.calls
    XCTAssertEqual(calls.plan, 1)
    XCTAssertEqual(calls.changed, 2)
    XCTAssertEqual(plan.value?.plan.planId, "plan-1")
  }

  func testPlanIsReadAgainWhenItChanged() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")

    await plan.load()
    await api.setChanged(true)
    await plan.refresh()

    let calls = await api.calls
    XCTAssertEqual(calls.plan, 2)
    XCTAssertEqual(calls.changed, 1)
    XCTAssertEqual(plan.value?.plan.planId, "plan-2")
  }

  func testPlanIsReadAgainOnANewDayWithoutAsking() async {
    let api = PlanAPIStub()
    let clock = TestClock(now: Date(timeIntervalSince1970: 1_800_000_000))
    let store = makeStore(api: api, clock: clock)
    let plan = store.plan(goalId: "goal")

    await plan.load()
    clock.now = clock.now.addingTimeInterval(24 * 60 * 60)
    await plan.refresh()

    let calls = await api.calls
    XCTAssertEqual(calls.plan, 2)
    XCTAssertEqual(calls.changed, 0)
  }

  func testShownPlanIsAskedAboutFromBeforeItWasRead() async {
    let api = PlanAPIStub()
    let clock = TestClock(now: Date(timeIntervalSince1970: 1_800_000_000))
    let store = makeStore(api: api, clock: clock)
    let plan = store.plan(goalId: "goal")

    await plan.load()
    await plan.refresh()

    let since = await api.lastSince
    XCTAssertEqual(since, clock.now.addingTimeInterval(-PlanStore.clockMargin))
  }

  func testAppliedChangeSaysWhatItDidAndUndoesIt() async {
    let api = PlanAPIStub()
    let editor = PlanEditor(goalId: "goal", store: makeStore(api: api))

    let applied = await editor.change([.dailyMinutes(20)], sentence: "Daily time changed.")
    XCTAssertTrue(applied)
    XCTAssertEqual(editor.latest, .applied(.stub, sentence: "Daily time changed."))

    await editor.undo()
    XCTAssertEqual(editor.latest, .undone)
    let calls = await api.calls
    XCTAssertEqual(calls.changes, [[.dailyMinutes(20)]])
    XCTAssertEqual(calls.undone, ["change-1"])
  }

  func testAppliedChangeRevalidatesThePlan() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()

    await PlanEditor(goalId: "goal", store: store).change([.dailyMinutes(20)], sentence: "")
    await api.setChanged(true)
    await plan.load()

    let calls = await api.calls
    XCTAssertEqual(calls.plan, 2)
  }

  func testSavedFocusTestSwitchShowsOnThePlanAtOnce() async throws {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()
    let saved = try JSONDecoder().decode(
      FocusTestSummary.self,
      from: Data(
        #"{"offer":null,"sessionQuestions":"paused","state":"sitting","suggestsFocus":false}"#
          .utf8))
    await api.setSavedFocusTest(saved)

    _ = await store.updateFocusTest(goalId: "goal", FocusTestControls(sessionQuestions: .paused))

    XCTAssertEqual(plan.value?.plan.focusTest, saved)
  }

  func testUnchangedAndRefusedChangesSaySo() async {
    let api = PlanAPIStub()
    let editor = PlanEditor(goalId: "goal", store: makeStore(api: api))

    await api.setChangeOutcome(.unchanged)
    await editor.change([.dailyMinutes(20)], sentence: "")
    XCTAssertEqual(editor.latest, .unchanged)

    await api.setChangeOutcome(.invalid)
    await editor.change([.targetDate("2020-01-01")], sentence: "")
    XCTAssertEqual(editor.latest, .invalid)
    XCTAssertFalse(editor.failed)
  }

  func testUndoneChangeSaysSoAndRevalidatesThePlan() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()

    await api.setChangeOutcome(.undone)
    let editor = PlanEditor(goalId: "goal", store: store)
    await editor.change([.targetDate(nil)], sentence: "")
    await plan.load()

    XCTAssertEqual(editor.latest, .undone)
    let calls = await api.calls
    XCTAssertEqual(calls.changed, 1)
  }

  func testFailedChangeKeepsTheLatestAndFlagsIt() async {
    let api = PlanAPIStub()
    let editor = PlanEditor(goalId: "goal", store: makeStore(api: api))
    await editor.change([.dailyMinutes(20)], sentence: "Daily time changed.")

    await api.setChangeError(APIError.network)
    await editor.change([.dailyMinutes(30)], sentence: "Other")

    XCTAssertTrue(editor.failed)
    XCTAssertEqual(editor.latest, .applied(.stub, sentence: "Daily time changed."))
  }

  func testFailedChangeAsksWhetherThePlanChangedAnyway() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()

    await api.setChangeError(APIError.network)
    await PlanEditor(goalId: "goal", store: store).change([.dailyMinutes(20)], sentence: "")
    await plan.load()

    let calls = await api.calls
    XCTAssertEqual(calls.changed, 1)
  }

  func testClearingTheDateSendsAnExplicitNull() throws {
    let json = try JSONEncoder().encode(PlanEdit.targetDate(nil))
    let object = try JSONSerialization.jsonObject(with: json) as? [String: Any]

    XCTAssertEqual(object?["kind"] as? String, "setTargetDate")
    XCTAssertTrue(object?["targetDate"] is NSNull)
  }

  func testUndoThePlanMovedPastFlagsIt() async {
    let api = PlanAPIStub()
    let editor = PlanEditor(goalId: "goal", store: makeStore(api: api))
    await editor.change([.dailyMinutes(20)], sentence: "Daily time changed.")

    await api.setUndoes(false)
    await editor.undo()

    XCTAssertTrue(editor.failed)
    XCTAssertEqual(editor.latest, .applied(.stub, sentence: "Daily time changed."))
  }

  func testExpiredSessionSignsOutInsteadOfSaving() async {
    let api = PlanAPIStub()
    let session = SessionStore.preview(account: .planTestAccount)
    let store = PlanStore(api: api, cache: AppCache(session: session))
    let editor = PlanEditor(goalId: "goal", store: store)

    await api.setChangeError(APIError.unauthorized)
    await editor.change([.dailyMinutes(20)], sentence: "")

    XCTAssertFalse(editor.failed)
    XCTAssertNil(editor.latest)
    XCTAssertNil(session.authenticatedSession)
  }

  func testAChangeMadeAsItsSheetClosesStillSaves() async {
    let api = PlanAPIStub()
    await api.hold(.change)
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()
    let editor = PlanEditor(goalId: "goal", store: store)

    editor.run { await editor.change([.dailyMinutes(20)], sentence: "") }
    await api.waitForHeldCall()
    editor.cancel()
    await api.releaseHeldCall()
    // The next change waits for it to save.
    _ = await store.change(goalId: "goal", edits: [.dailyMinutes(30)])
    await api.setChanged(true)
    await plan.load()

    let calls = await api.calls
    XCTAssertEqual(calls.changes, [[.dailyMinutes(20)], [.dailyMinutes(30)]])
    XCTAssertEqual(plan.value?.plan.planId, "plan-2", "the plan reads what the change made")
    XCTAssertNil(editor.latest, "a closed sheet shows nothing of it")
  }

  func testAChangeMadeWhileAnotherSavesGoesOutAfterIt() async {
    let api = PlanAPIStub()
    await api.hold(.change)
    let store = makeStore(api: api)

    let first = Task { await store.change(goalId: "goal", edits: [.dailyMinutes(20)]) }
    await api.waitForHeldCall()
    // Released once the second change is made and waiting.
    Task { await api.releaseHeldCall() }
    let second = await store.change(goalId: "goal", edits: [.dailyMinutes(30)])
    let firstSaved = await first.value

    let calls = await api.calls
    XCTAssertEqual(calls.changes, [[.dailyMinutes(20)], [.dailyMinutes(30)]])
    guard case .done = firstSaved, case .done = second else {
      return XCTFail("both changes save")
    }
  }

  func testAFitOfferWhoseNumbersHoldIsAppliedOnceChecked() async throws {
    let api = PlanAPIStub()
    let offer = try fitOffer()
    await api.setPreview(preview(effect: offer.effect))
    var applied: [[PlanEdit]] = []

    let check = await makeStore(api: api).addFitOffer(offer, goalId: "goal") { applied.append($0) }

    XCTAssertEqual(check, .applied)
    XCTAssertEqual(applied.count, 1)
  }

  func testAFitOfferPutOffWhileItsCheckWaitsChangesNothing() async throws {
    let api = PlanAPIStub()
    let offer = try fitOffer()
    await api.setPreview(preview(effect: offer.effect))
    await api.hold(.preview)
    let store = makeStore(api: api)
    var applied: [[PlanEdit]] = []

    let check = Task { await store.addFitOffer(offer, goalId: "goal") { applied.append($0) } }
    await api.waitForHeldCall()
    check.cancel()
    await api.releaseHeldCall()

    let answer = await check.value
    XCTAssertNil(answer)
    XCTAssertEqual(applied, [], "the learner put the offer off")
  }

  func testAnArchivedExamLeavesThePlanOnceSaved() async {
    var left = false

    let saved = await makeStore(api: PlanAPIStub()).archive(goalId: "goal") { left = true }

    XCTAssertTrue(saved)
    XCTAssertTrue(left)
  }

  func testAnArchiveTheLearnerLeftWhileItSavedSavesAndLeavesNothing() async {
    let api = PlanAPIStub()
    await api.hold(.setStatus)
    let store = makeStore(api: api)
    var left = false

    let archive = Task { await store.archive(goalId: "goal") { left = true } }
    await api.waitForHeldCall()
    archive.cancel()
    await api.releaseHeldCall()
    _ = await archive.value

    let calls = await api.calls
    XCTAssertEqual(calls.statuses, [.archived], "the learner archived it on purpose")
    XCTAssertFalse(left, "what the learner opened since stays open")
  }

  func testPrerequisitesAdviceIsAskedOnceAndShownAgainOnReopen() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)

    await store.basesAdvice(goalId: "goal").load()
    await store.basesAdvice(goalId: "goal").load()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 1)
    XCTAssertEqual(store.basesAdvice(goalId: "goal").value?.recommended, .essential)
  }

  func testAFailedAdviceRefreshKeepsTheRecommendation() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let advice = store.basesAdvice(goalId: "goal")

    await advice.load()
    await api.setAdviceFails(true)
    await advice.refresh()

    XCTAssertEqual(advice.value?.recommended, .essential)
  }

  func testTimeToCoverIsAskedOnceAndShownAgainOnReopen() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)

    await store.timeToCover(goalId: "goal").load()
    await store.timeToCover(goalId: "goal").load()

    let calls = await api.calls
    XCTAssertEqual(calls.timeToCover, 1)
    XCTAssertEqual(store.timeToCover(goalId: "goal").freshValue?.recommendedMinutes, 45)
  }

  func testAFailedTimeToCoverRefreshKeepsTheAnswer() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let time = store.timeToCover(goalId: "goal")

    await time.load()
    await api.setTimeToCoverFails(true)
    await time.refresh()

    XCTAssertEqual(time.freshValue?.recommendedMinutes, 45)
  }

  func testAPlanChangeHidesTheEarlierTimeToCoverAndAsksAgain() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let editor = PlanEditor(goalId: "goal", store: store)
    let time = store.timeToCover(goalId: "goal")

    await time.load()
    _ = await editor.change([.dailyMinutes(60)], sentence: "")

    XCTAssertNil(time.freshValue, "it described the time before the change")

    await time.load()

    let calls = await api.calls
    XCTAssertEqual(calls.timeToCover, 2)
    XCTAssertEqual(time.freshValue?.recommendedMinutes, 45)
  }

  func testAReopenedCoverageSuggestionShowsTheAnswerWithoutAsking() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    await store.timeToCover(goalId: "goal").load()

    let reopened = PlanCoverageSlot.found(store.timeToCover(goalId: "goal"), isAsked: true)

    let calls = await api.calls
    XCTAssertEqual(calls.timeToCover, 1)
    guard case .time(let time)? = reopened else {
      return XCTFail("the answer it had shows at once, so See what changes needs no request")
    }
    XCTAssertEqual(time.recommendedMinutes, 45)
  }

  func testAFailedRefreshKeepsTheCoverageSuggestionsAnswer() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let time = store.timeToCover(goalId: "goal")
    await time.load()
    await api.setTimeToCoverFails(true)

    await time.refresh()

    guard case .time? = PlanCoverageSlot.found(time, isAsked: true) else {
      return XCTFail("a failed refresh keeps the answer instead of an error")
    }
  }

  func testACoverageSuggestionNotAskedYetWaitsForTheLearner() {
    let store = makeStore(api: PlanAPIStub())

    XCTAssertNil(PlanCoverageSlot.found(store.timeToCover(goalId: "goal"), isAsked: false))
  }

  func testAChangedPlanFromTheServerHidesItsEarlierAnswersWithoutAsking() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    let time = store.timeToCover(goalId: "goal")
    let advice = store.basesAdvice(goalId: "goal")
    await plan.load()
    await time.load()
    await advice.load()

    await api.setChanged(true)
    await plan.refresh()

    let calls = await api.calls
    XCTAssertEqual(plan.value?.plan.planId, "plan-2")
    XCTAssertNil(time.freshValue, "it described the plan before another device changed it")
    XCTAssertNil(PlanBasesView.recommended(advice))
    XCTAssertEqual(calls.timeToCover, 1, "nobody is looking at it, so nothing asks yet")
    XCTAssertEqual(calls.advice, 1)
  }

  func testAChangedPlanWithThePrerequisitesSheetOpenAsksNothingUntilItsNextOpening() async throws {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    let advice = store.basesAdvice(goalId: "goal")
    await plan.load()
    await advice.load()
    advice.beginViewing()
    defer { advice.endViewing() }

    await api.setChanged(true)
    await plan.refresh()
    try await Task.sleep(for: .seconds(0.3))

    var calls = await api.calls
    XCTAssertNil(PlanBasesView.recommended(advice), "it was worked out for the plan before")
    XCTAssertEqual(calls.advice, 1, "only an opening asks for it")

    await advice.load()

    calls = await api.calls
    XCTAssertEqual(calls.advice, 2)
    XCTAssertEqual(PlanBasesView.recommended(advice), .essential)
  }

  func testAChangedPlanWithTheSameInputsKeepsItsAnswers() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    let time = store.timeToCover(goalId: "goal")
    await api.setPlanId("plan-1")
    await plan.load()
    await time.load()

    await api.setChanged(true)
    await plan.refresh()

    let calls = await api.calls
    XCTAssertEqual(calls.plan, 2, "the server said it changed, so it's read again")
    XCTAssertEqual(time.freshValue?.recommendedMinutes, 45)
  }

  func testANewDaysPlanHidesYesterdaysAdviceAndTheNextOpeningAsks() async {
    let api = PlanAPIStub()
    let clock = TestClock(now: Date(timeIntervalSince1970: 1_800_000_000))
    let store = makeStore(api: api, clock: clock)
    let plan = store.plan(goalId: "goal")
    let advice = store.basesAdvice(goalId: "goal")
    await api.setPlanId("plan-1")
    await plan.load()
    await advice.load()

    clock.now = clock.now.addingTimeInterval(86_400)
    await api.setToday("2027-01-05")
    await api.setAdvised(.quick)
    await plan.refresh()

    XCTAssertNil(PlanBasesView.recommended(advice), "it was worked out for yesterday's days left")

    await advice.load()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 2)
    XCTAssertEqual(PlanBasesView.recommended(advice), .quick)
  }

  func testAdviceAskedBeforeANewDayNeverMarksYesterdaysOption() async {
    let api = PlanAPIStub()
    let clock = TestClock(now: Date(timeIntervalSince1970: 1_800_000_000))
    let store = makeStore(api: api, clock: clock)
    let plan = store.plan(goalId: "goal")
    let advice = store.basesAdvice(goalId: "goal")
    await api.setPlanId("plan-1")
    await plan.load()
    await api.hold(.advice)
    let asking = Task { await advice.load() }
    await api.waitForHeldCall()

    clock.now = clock.now.addingTimeInterval(86_400)
    await api.setToday("2027-01-05")
    await api.setAdvised(.quick)
    await plan.refresh()
    await api.releaseHeldCall()
    await asking.value

    XCTAssertEqual(PlanBasesView.recommended(advice), .quick)
  }

  func testAnAnswerNotReadyYetLetsTheNextOpeningAsk() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let advice = store.basesAdvice(goalId: "goal")
    let time = store.timeToCover(goalId: "goal")
    await api.setAnswersReady(false)
    await advice.load()
    await time.load()

    await api.setAnswersReady(true)
    await advice.load()
    await time.load()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 2)
    XCTAssertEqual(calls.timeToCover, 2)
    XCTAssertEqual(PlanBasesView.recommended(advice), .essential)
    XCTAssertEqual(time.freshValue?.recommendedMinutes, 45)
  }

  func testPrerequisitesHideAdviceALocalChangeInvalidated() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let advice = store.basesAdvice(goalId: "goal")
    await advice.load()

    await PlanEditor(goalId: "goal", store: store).change([.dailyMinutes(15)], sentence: "")
    await api.setAdviceFails(true)
    await advice.load()

    XCTAssertNil(
      PlanBasesView.recommended(advice), "it was worked out for more time than the learner has now")
  }

  func testAFailedPreviewLeavesThePlanAlone() async {
    let api = PlanAPIStub()
    let store = makeStore(api: api)
    let plan = store.plan(goalId: "goal")
    await plan.load()
    await api.setPreviewFails(true)

    let preview = await PlanEditor(goalId: "goal", store: store).preview([
      .dailyMinutes(60)
    ])
    await plan.load()

    let calls = await api.calls
    XCTAssertNil(preview)
    XCTAssertEqual(calls.plan + calls.changed, 1, "a preview saves nothing to read again")
  }

  func testSuggestionStateBelongsToTheSessionThatMadeIt() {
    let store = makeStore(api: PlanAPIStub())
    let earlier = PlanStore.SuggestionKey(
      owner: AuthenticatedSession(bearerToken: "earlier-session"), goalId: "goal")

    store.setSuggestionState(earlier) { $0.dismissed.insert(.tooTight) }

    XCTAssertEqual(store.suggestionState(goalId: "goal").dismissed, [])

    store.setSuggestionState(store.suggestionKey(goalId: "goal")) { $0.dismissed.insert(.tooTight) }
    XCTAssertEqual(store.suggestionState(goalId: "goal").dismissed, [.tooTight])
  }

  /// A fixed clock and zone: a real one in the minute after midnight puts a plan's read on the day before.
  private func fitOffer() throws -> GoalPlan.FitOffer {
    try JSONDecoder().decode(
      GoalPlan.FitOffer.self,
      from: Data(
        #"""
        {"canApply":true,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":true,
         "operations":[{"kind":"addLessons","count":6}]}
        """#.utf8))
  }

  private func preview(effect: PlanEffect) -> PlanChangePreview {
    PlanChangePreview(
      effect: effect, feasibility: nil, finishDate: nil, ready: true, unchanged: false)
  }

  private func makeStore(
    api: PlanAPIStub, clock: TestClock = TestClock(now: Date(timeIntervalSince1970: 1_800_000_000))
  ) -> PlanStore {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt

    return PlanStore(
      api: api,
      cache: AppCache(session: .preview(account: .planTestAccount)),
      calendar: calendar,
      now: { clock.now })
  }
}

@MainActor
final class PlanReadsOnScreenTests: XCTestCase {
  func testThePrerequisitesSheetAsksOnceAcrossAReopen() async throws {
    let api = PlanAPIStub()
    let screen = try Screen(api: api)
    try show(screen.view { $0.basesSheet })
    try await screen.settle()

    try await screen.reopen()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 1)
  }

  func testTheTimeSectionAsksOnceAcrossAReopen() async throws {
    let api = PlanAPIStub()
    let screen = try Screen(api: api)
    try show(screen.view { $0.timeSection })
    try await screen.settle()

    try await screen.reopen()

    let calls = await api.calls
    XCTAssertEqual(calls.timeToCover, 1)
  }

  func testTheTimeSectionAsksAgainOnAVisitAfterAFailedRead() async throws {
    let api = PlanAPIStub()
    let screen = try Screen(api: api)
    try show(screen.view { $0.timeSection })
    try await screen.settle()

    screen.isOpen = false
    await screen.editor.change([.dailyMinutes(45)], sentence: "")
    await api.setTimeToCoverFails(true)
    try await screen.reopen()
    await api.setTimeToCoverFails(false)
    try await screen.reopen()

    let calls = await api.calls
    XCTAssertEqual(calls.timeToCover, 3, "the visit after a failed read asks again")
    XCTAssertEqual(screen.store.timeToCover(goalId: "goal").freshValue?.recommendedMinutes, 45)
  }

  func testReopeningThePrerequisitesSheetWhileItAsksAsksNothingMore() async throws {
    let api = PlanAPIStub()
    let screen = try Screen(api: api)
    await api.hold(.advice)
    try show(screen.view { $0.basesSheet })
    await api.waitForHeldCall()

    try await screen.reopen()
    await api.releaseHeldCall()
    try await screen.settle()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 1)
    XCTAssertEqual(PlanBasesView.recommended(screen.store.basesAdvice(goalId: "goal")), .essential)
  }

  func testTheTimeSectionsOfferArrivingMovesNothingUnderIt() async throws {
    let api = PlanAPIStub()
    await api.setSuggested(
      TimeToCover.Suggested(
        coveredShare: 1, everyTopic: true, kind: .everything, minutes: 60, split: nil))
    let rows = try await rowUnderTimeSection(api: api) { await api.releaseHeldCall() }

    XCTAssertEqual(rows.count, 1, "The row under it moved: \(rows)")
  }

  func testTheTimeSectionsFailedReadMovesNothingUnderIt() async throws {
    let api = PlanAPIStub()
    await api.setTimeToCoverFails(true)
    let rows = try await rowUnderTimeSection(api: api) { await api.releaseHeldCall() }

    XCTAssertEqual(rows.count, 1, "The row under it moved: \(rows)")
  }

  /// Where the row under the time section sits, at a large text size in a narrow column, from the
  /// moment the time is asked until after `answer` lets it land.
  private func rowUnderTimeSection(
    api: PlanAPIStub, answer: () async -> Void
  ) async throws -> [CGFloat] {
    let screen = try Screen(api: api)
    var rows: [CGFloat] = []
    await api.hold(.timeToCover)

    try show(
      screen.view { screen in
        List {
          PlanTimeSection(
            editor: screen.editor, goal: screen.goal, plan: screen.plan, weekendOn: false)

          Text(verbatim: "Next row")
            .onGeometryChange(for: CGFloat.self, of: { $0.frame(in: .global).minY }) {
              rows.append($0)
            }
        }
        .frame(width: 320)
        .dynamicTypeSize(.accessibility2)
      })
    await api.waitForHeldCall()
    try await screen.settle()

    await answer()
    try await screen.settle()
    return rows
  }

  func testThePrerequisitesSheetAsksAgainOnAVisitAfterAFailedRead() async throws {
    let api = PlanAPIStub()
    let screen = try Screen(api: api)
    try show(screen.view { $0.basesSheet })
    try await screen.settle()

    screen.isOpen = false
    await screen.editor.change([.dailyMinutes(45)], sentence: "")
    await api.setAdviceFails(true)
    try await screen.reopen()
    await api.setAdviceFails(false)
    try await screen.reopen()

    let calls = await api.calls
    XCTAssertEqual(calls.advice, 3, "the visit after a failed read asks again")
  }
}

@MainActor
@Observable
private final class Screen {
  var isOpen = true
  let store: PlanStore
  let editor: PlanEditor
  let plan: GoalPlan
  let goal = LearnerGoal(
    dailyMinutes: 30, id: "goal", kind: .learn, language: "en", status: .active,
    targetDate: "2027-06-01", displayName: "Investing", title: "Investing")

  init(api: PlanAPIStub) throws {
    store = PlanStore(api: api, cache: AppCache(session: .preview(account: .planTestAccount)))
    editor = PlanEditor(goalId: "goal", store: store)
    plan = try .stub(planId: "plan-1", targetDate: "2027-06-01")
  }

  var timeSection: some View {
    List {
      PlanTimeSection(editor: editor, goal: goal, plan: plan, weekendOn: false)
    }
  }

  var basesSheet: some View {
    NavigationStack {
      PlanBasesView(editor: editor, goal: goal, plan: plan, bases: GoalPlan.Bases(items: []))
    }
  }

  func view<Content: View>(_ content: @escaping (Screen) -> Content) -> some View {
    Opened(screen: self, content: content)
      .environment(store)
      .environment(store.cache.session)
  }

  /// Closes it, then opens it again, each long enough for its reads to land.
  func reopen() async throws {
    isOpen = false
    try await settle()
    isOpen = true
    try await settle()
  }

  func settle() async throws {
    try await Task.sleep(for: .seconds(0.5))
  }
}

private struct Opened<Content: View>: View {
  let screen: Screen
  let content: (Screen) -> Content

  var body: some View {
    if screen.isOpen {
      content(screen)
    }
  }
}

@MainActor
private final class TestClock {
  var now: Date

  init(now: Date) {
    self.now = now
  }
}

/// Also Today's tests', for plan changes saved from the Plan's screens.
actor PlanAPIStub: PlanAPIClient {
  struct Calls {
    var advice = 0
    var changed = 0
    var changes: [[PlanEdit]] = []
    var plan = 0
    var statuses: [GoalStatusChange] = []
    var timeToCover = 0
    var undone: [String] = []
  }

  private(set) var calls = Calls()
  private(set) var lastSince: Date?
  private var adviceFails = false
  private var planId: String?
  private var today = "2027-01-04"
  private var advised = BaseChoice.essential
  private var answersReady = true
  private var suggested: TimeToCover.Suggested?
  private var previewFails = false
  private var timeToCoverFails = false
  private var changed = false
  private var changeError: Error?
  private var changeOutcome = PlanChangeOutcome.applied(.stub)
  private var undoes = true
  private var savedFocusTest: FocusTestSummary?
  private var previewed: PlanChangePreview?
  private var holds: HeldCall?
  private var heldCall: CheckedContinuation<Void, Never>?
  private var heldCallWaiter: CheckedContinuation<Void, Never>?

  enum HeldCall {
    case advice
    case timeToCover
    case change
    case preview
    case setStatus
  }

  func setAdviceFails(_ fails: Bool) { adviceFails = fails }
  /// Every read answers the same plan, as a read after progress that changed nothing it plans does.
  func setPlanId(_ id: String) { planId = id }
  func setToday(_ day: String) { today = day }
  func setAdvised(_ choice: BaseChoice) { advised = choice }
  func setAnswersReady(_ ready: Bool) { answersReady = ready }
  func setSuggested(_ suggested: TimeToCover.Suggested) { self.suggested = suggested }
  func setPreviewFails(_ fails: Bool) { previewFails = fails }
  func setTimeToCoverFails(_ fails: Bool) { timeToCoverFails = fails }
  func setChanged(_ changed: Bool) { self.changed = changed }
  func setChangeError(_ error: Error) { changeError = error }
  func setChangeOutcome(_ outcome: PlanChangeOutcome) { changeOutcome = outcome }
  func setUndoes(_ undoes: Bool) { self.undoes = undoes }
  func setSavedFocusTest(_ summary: FocusTestSummary) { savedFocusTest = summary }

  func setPreview(_ preview: PlanChangePreview) { previewed = preview }

  /// The next `call` waits for `releaseHeldCall()`.
  func hold(_ call: HeldCall) { holds = call }

  func waitForHeldCall() async {
    guard heldCall == nil else {
      return
    }

    await withCheckedContinuation { heldCallWaiter = $0 }
  }

  func releaseHeldCall() {
    heldCall?.resume()
    heldCall = nil
  }

  private func holdIfAsked(_ call: HeldCall) async {
    guard holds == call else {
      return
    }

    holds = nil
    await withCheckedContinuation { continuation in
      heldCall = continuation
      heldCallWaiter?.resume()
      heldCallWaiter = nil
    }
  }

  func plan(token: String, goalId: String) async throws -> GoalPlan {
    calls.plan += 1
    return try .stub(planId: planId ?? "plan-\(calls.plan)", today: today)
  }

  func planChanged(token: String, goalId: String, since: Date) async throws -> Bool {
    calls.changed += 1
    lastSince = since
    return changed
  }

  func change(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanChangeOutcome {
    await holdIfAsked(.change)
    // As URLSession does, a request whose task was canceled meanwhile doesn't arrive.
    try Task.checkCancellation()

    if let changeError {
      throw changeError
    }

    calls.changes.append(edits)
    return changeOutcome
  }

  func decide(
    token: String, goalId: String, changeId: String, decision: PlanChangeDecision,
    quote: PlanChangeQuote?
  ) async throws -> TodayView.PlanChange? {
    calls.undone.append(changeId)
    guard undoes else {
      return nil
    }

    return try JSONDecoder().decode(TodayView.PlanChange.self, from: Self.undoneChange)
  }

  private static let undoneChange = Data(
    #"""
    {"behind":null,"canApply":false,"canUndo":false,"effect":null,"examDocument":"notice","quote":"q1",
    "id":"change-1","kind":"edited","officialDate":null,"operations":[],"reason":null,
    "source":"planEdit","status":"undone","todaySession":null}
    """#.utf8)

  func updateFocusTest(token: String, goalId: String, controls: FocusTestControls) async throws
    -> FocusTestSummary
  {
    guard let savedFocusTest else {
      throw APIError.notFound
    }

    return savedFocusTest
  }

  func syllabus(token: String, goalId: String) async throws -> GoalSyllabus {
    throw APIError.notFound
  }
  func standing(token: String, goalId: String) async throws -> GoalStanding {
    throw APIError.notFound
  }
  func languageStanding(token: String, goalId: String) async throws -> LanguageStanding {
    throw APIError.notFound
  }
  func languageUnits(token: String, goalId: String) async throws -> LanguageUnitsOverview {
    throw APIError.notFound
  }
  func planEnd(token: String, goalId: String) async throws -> PlanEnd {
    PlanEnd(certificates: nil, next: nil)
  }
  func resumeChangesPlan(token: String, goalId: String) async throws -> Bool { false }
  func setStatus(token: String, goalId: String, status: GoalStatusChange) async throws
    -> GoalStatusOutcome
  {
    await holdIfAsked(.setStatus)
    try Task.checkCancellation()
    calls.statuses.append(status)
    return .saved
  }
  func rename(token: String, goalId: String, displayName: String) async throws -> Bool { true }
  func preview(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanChangePreview?
  {
    await holdIfAsked(.preview)

    guard !previewFails else {
      throw APIError.network
    }

    return previewed
  }
  func chooseExamOption(token: String, goalId: String, group: String, subjects: [String])
    async throws -> PlanChangeOutcome
  { .unchanged }
  func chooseTools(
    token: String, goalId: String, tools: [String], choice: ToolChoice, system: String?,
    whileWriting: @escaping @MainActor () -> Void
  ) async throws -> PlanChangeOutcome { .unchanged }
  func timeToCover(token: String, goalId: String) async throws -> TimeToCover {
    calls.timeToCover += 1
    await holdIfAsked(.timeToCover)

    guard !timeToCoverFails else {
      throw APIError.network
    }

    return TimeToCover(
      fittingDate: nil, most: nil, pastDate: false, readingNotice: false, ready: answersReady,
      recommendedMinutes: 45, suggested: suggested, targetDate: "2027-11-14",
      targetDateNamedMonth: false)
  }
  func basesAdvice(token: String, goalId: String) async throws -> PlanBasesAdvice {
    calls.advice += 1
    // Worked out when asked, for the plan of that moment.
    let answer = PlanBasesAdvice(ready: answersReady, recommended: advised)
    await holdIfAsked(.advice)

    guard !adviceFails else {
      throw APIError.unavailable
    }

    return answer
  }
  func continueAtNextLevel(token: String, goalId: String) async throws -> Bool { false }
  func skipAlphabet(token: String, goalId: String) async throws -> Bool { false }
  func goalGenerationId(token: String, goalId: String) async throws -> String? { nil }
  func restartGeneration(token: String, goalId: String) async throws -> String? { nil }
  nonisolated func generationEvents(id: String, token: String)
    -> AsyncThrowingStream<GenerationEvent, Error>
  { AsyncThrowingStream { $0.finish() } }
  func outline(token: String, goalId: String, skillId: String) async throws -> SkillOutline {
    throw APIError.notFound
  }
  func createOutline(token: String, goalId: String, skillId: String) async throws -> OutlineRequest
  { .unavailable }
}

extension AppliedPlanChange {
  fileprivate static let stub = AppliedPlanChange(
    canUndo: true, effect: nil, id: "change-1", status: "applied", todaySession: "unchanged")
}

extension GoalPlan {
  fileprivate static func stub(
    planId: String, targetDate: String? = nil, today: String = "2027-01-04"
  ) throws -> GoalPlan {
    let date = targetDate.map { "\"\($0)\"" } ?? "null"
    let feasibility =
      targetDate.map {
        """
        {"coreFits": false, "coveredShare": 0.6, "deadline": "\($0)", "deepensMostAsked": false,
         "fits": false, "measure": "goal", "timeCovers": false}
        """
      } ?? "null"
    let json = """
      {
        "access": { "mocksRequirePlus": false },
        "areas": [], "bases": null, "course": null, "end": null,
        "estimate": { "endDate": null, "fullCourseEndDate": null },
        "examChoices": [], "examDocument": "notice", "feasibility": \(feasibility), "fitOffer": null,
        "goalId": "goal",
        "phases": [], "planId": "\(planId)", "ready": true,
        "schedule": {
          "dailyMinutes": 30, "dailyTimes": [15, 30, 45], "fullCourse": false, "studyDays": 7,
          "targetDate": \(date),
          "targetDateEstimated": false, "targetDateNamedMonth": false,
          "shape": {
            "canDiffer": true, "weekdayDays": [1, 2, 3, 4, 5], "weekdays": 30, "weekend": null,
            "weekendDays": [0, 6]
          },
          "weekdayMinutes": [30, 30, 30, 30, 30, 30, 30]
        },
        "status": { "kind": "onTrack" },
        "steering": {
          "difficultyBias": "standard", "lessonsStudied": 0, "practiceBias": "balanced",
          "skippedActivities": []
        },
        "tools": [], "week": { "days": [], "startDate": "\(today)" },
        "weekTime": { "studiedMinutes": 0, "targetMinutes": 210 }, "writtenPractice": null
      }
      """
    return try JSONDecoder().decode(GoalPlan.self, from: Data(json.utf8))
  }
}

extension CurrentAccount {
  fileprivate static let planTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test",
      id: "plan-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
