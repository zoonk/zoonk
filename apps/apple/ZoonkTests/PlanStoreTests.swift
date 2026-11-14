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
    var undone: [String] = []
  }

  private(set) var calls = Calls()
  private(set) var lastSince: Date?
  private var adviceFails = false
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
    case change
    case preview
    case setStatus
  }

  func setAdviceFails(_ fails: Bool) { adviceFails = fails }
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
    return try .stub(planId: "plan-\(calls.plan)")
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
    throw APIError.unavailable
  }
  func basesAdvice(token: String, goalId: String) async throws -> PlanBasesAdvice {
    calls.advice += 1

    guard !adviceFails else {
      throw APIError.unavailable
    }

    return PlanBasesAdvice(ready: true, recommended: .essential)
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
  fileprivate static func stub(planId: String) throws -> GoalPlan {
    let json = """
      {
        "access": { "mocksRequirePlus": false },
        "areas": [], "bases": null, "course": null, "end": null,
        "estimate": { "endDate": null, "fullCourseEndDate": null },
        "examChoices": [], "examDocument": "notice", "feasibility": null, "fitOffer": null, "goalId": "goal",
        "phases": [], "planId": "\(planId)", "ready": true,
        "schedule": {
          "dailyMinutes": 30, "dailyTimes": [15, 30, 45], "fullCourse": false, "studyDays": 7,
          "targetDate": null,
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
        "tools": [], "week": { "days": [], "startDate": "2027-01-04" },
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
