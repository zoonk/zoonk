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

  func testFailedChangeKeepsTheLatestAndFlagsIt() async {
    let api = PlanAPIStub()
    let editor = PlanEditor(goalId: "goal", store: makeStore(api: api))
    await editor.change([.dailyMinutes(20)], sentence: "Daily time changed.")

    await api.setChangeError(APIError.network)
    await editor.change([.dailyMinutes(30)], sentence: "Other")

    XCTAssertTrue(editor.failed)
    XCTAssertEqual(editor.latest, .applied(.stub, sentence: "Daily time changed."))
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

    XCTAssertTrue(editor.failed)
    XCTAssertNil(session.authenticatedSession)
  }

  private func makeStore(api: PlanAPIStub, clock: TestClock = TestClock(now: .now)) -> PlanStore {
    PlanStore(
      api: api,
      cache: AppCache(session: .preview(account: .planTestAccount)),
      calendar: Calendar(identifier: .gregorian),
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

private actor PlanAPIStub: PlanAPIClient {
  struct Calls {
    var changed = 0
    var changes: [[PlanEdit]] = []
    var plan = 0
    var undone: [String] = []
  }

  private(set) var calls = Calls()
  private(set) var lastSince: Date?
  private var changed = false
  private var changeError: Error?
  private var changeOutcome = PlanChangeOutcome.applied(.stub)
  private var undoes = true

  func setChanged(_ changed: Bool) { self.changed = changed }
  func setChangeError(_ error: Error) { changeError = error }
  func setChangeOutcome(_ outcome: PlanChangeOutcome) { changeOutcome = outcome }
  func setUndoes(_ undoes: Bool) { self.undoes = undoes }

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
    if let changeError {
      throw changeError
    }

    calls.changes.append(edits)
    return changeOutcome
  }

  func undo(token: String, goalId: String, changeId: String) async throws -> Bool {
    calls.undone.append(changeId)
    return undoes
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
  func studyNext(token: String, goalId: String) async throws -> StudyNext? { nil }
  func resumeChangesPlan(token: String, goalId: String) async throws -> Bool { false }
  func setStatus(token: String, goalId: String, status: GoalStatusChange) async throws
    -> GoalStatusOutcome
  { .saved }
  func preview(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanEffect? { nil }
  func chooseExamOption(token: String, goalId: String, group: String, subject: String)
    async throws -> PlanChangeOutcome
  { .unchanged }
  func chooseTools(
    token: String, goalId: String, tools: [String], choice: ToolChoice, system: String?
  ) async throws -> PlanChangeOutcome { .unchanged }
  func timeToCover(token: String, goalId: String) async throws -> PlanTimeToCover {
    throw APIError.unavailable
  }
  func basesAdvice(token: String, goalId: String) async throws -> PlanBasesAdvice {
    throw APIError.unavailable
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
  { .limit }
}

extension AppliedPlanChange {
  fileprivate static let stub = AppliedPlanChange(
    canUndo: true, effect: nil, id: "change-1", todaySession: "unchanged")
}

extension GoalPlan {
  fileprivate static func stub(planId: String) throws -> GoalPlan {
    let json = """
      {
        "access": { "freeWeekOver": false, "mocksRequirePlus": false },
        "areas": [], "bases": null, "course": null, "end": null,
        "estimate": { "endDate": null, "fullCourseEndDate": null },
        "examChoices": [], "feasibility": null, "fitOffer": null, "goalId": "goal",
        "phases": [], "planId": "\(planId)", "ready": true,
        "schedule": {
          "dailyMinutes": 30, "fullCourse": false, "studyDays": 7, "targetDate": null,
          "targetDateEstimated": false, "targetDateNamedMonth": false,
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
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "plan-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
