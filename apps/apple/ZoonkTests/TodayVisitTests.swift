import SwiftUI
import XCTest

@testable import Zoonk

/// What Today asked, and how it ended, is the visit's. A failure shown before the learner left is
/// gone when they come back, and one that lands after they left says nothing.
@MainActor
final class TodayVisitTests: XCTestCase {
  func testReturningWhileKeepStudyingSavesDoesNotSendAnotherChange() async throws {
    let visit = try await todayVisit(try day(pastDate: true), holding: "createPlanChange")
    let label = String(localized: "Keep studying", table: "Plan")
    try await visit.activate(label)
    await visit.server.waitForHeldRequest()
    try await visit.leaveAndComeBack()
    if spoken(in: visit.window).contains(label) {
      try activate(label, in: visit.window)
    }
    await visit.server.release()
    try await visit.settle()
    let changes = await visit.server.writes.filter { $0 == "createPlanChange" }
    XCTAssertEqual(changes.count, 1)
  }

  func testAnExamKeepStudyingFailureEndsWithTheVisit() async throws {
    let visit = try await todayVisit(try day(pastDate: true))
    try await visit.settle()
    try await visit.activate(String(localized: "Keep studying", table: "Plan"))
    try await visit.settle()
    visit.assertSays(Self.suggestionFailure)
    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.suggestionFailure)
  }

  func testAnExamKeepStudyingFailureAfterLeavingSaysNothing() async throws {
    let visit = try await todayVisit(try day(pastDate: true), holding: "createPlanChange")
    try await visit.settle()
    try await visit.activate(String(localized: "Keep studying", table: "Plan"))
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.suggestionFailure)
  }

  // MARK: Catch-up

  func testACatchUpFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await todayVisit(try day(catchUp: true))
    try await visit.settle()

    try await visit.activate(String(localized: "Add to today", table: "Today"))
    try await visit.settle()
    visit.assertSays(Self.todayFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.todayFailure)
  }

  // MARK: Insight

  func testAnInsightFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await todayVisit(try day(notice: .insight))
    try await visit.settle()

    try await visit.activate(String(localized: "Got it", table: "Buddy"))
    try await visit.settle()
    visit.assertSays(Self.insightFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.insightFailure)
  }

  func testAnInsightAnswerThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let visit = try await todayVisit(try day(notice: .insight), holding: "answerMemoryInsight")
    try await visit.settle()

    try await visit.activate(String(localized: "Got it", table: "Buddy"))
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.insightFailure)
  }

  // MARK: Upload request

  func testAnUploadRequestNotNowFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await todayVisit(try day(notice: .uploadRequest))
    try await visit.settle()

    try await visit.activate(String(localized: "Not now", table: "Today"))
    try await visit.settle()
    visit.assertSays(Self.todayFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.todayFailure)
  }

  func testAnUploadRequestNotNowThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let visit = try await todayVisit(
      try day(notice: .uploadRequest), holding: "dismissGoalUploadRequest")
    try await visit.settle()

    try await visit.activate(String(localized: "Not now", table: "Today"))
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.todayFailure)
  }

  // MARK: Focus test

  func testAFocusTestNotNowFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await todayVisit(try day(notice: .focusTest))
    try await visit.settle()

    try await openFocusTest(visit)
    try await visit.activate(String(localized: FocusTestCopy.notNow))
    try await visit.settle()
    visit.assertSays(Self.suggestionFailure)

    try await visit.leaveAndComeBack()
    try await openFocusTest(visit)
    visit.assertSaysNothingOf(Self.suggestionFailure)
  }

  func testAFocusTestNotNowThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let visit = try await todayVisit(try day(notice: .focusTest), holding: "updateGoalFocusTest")
    try await visit.settle()

    try await openFocusTest(visit)
    try await visit.activate(String(localized: FocusTestCopy.notNow))
    try await visit.failAfterLeaving()
    try await openFocusTest(visit)
    visit.assertSaysNothingOf(Self.suggestionFailure)
  }

  func testClosingFocusTestWhileNotNowSavesStillShowsItsSuccessOnToday() async throws {
    let visit = try await todayVisit(try day(notice: .focusTest), holding: "updateGoalFocusTest")
    await visit.server.setFocusTestResult(
      #"{"offer":null,"sessionQuestions":"paused","state":"notStarted","suggestsFocus":false}"#)
    try await visit.settle()
    try await openFocusTest(visit)
    try await visit.activate(String(localized: FocusTestCopy.notNow))
    await visit.server.waitForHeldRequest()
    try closeRequestSheet(in: visit.window)
    try await visit.settle()
    await visit.server.release()
    try await visit.settle()
    visit.assertSays(String(localized: "You can take the test from your plan.", table: "Today"))
    XCTAssertNil(visit.window.rootViewController?.presentedViewController)
  }

  func testClosingFocusTestBeforeNotNowFailsLeavesTheNextOpeningClean() async throws {
    let visit = try await todayVisit(try day(notice: .focusTest), holding: "updateGoalFocusTest")
    try await visit.settle()
    try await openFocusTest(visit)
    try await visit.activate(String(localized: FocusTestCopy.notNow))
    await visit.server.waitForHeldRequest()
    try closeRequestSheet(in: visit.window)
    try await visit.settle()
    await visit.server.release()
    try await visit.settle()
    try await openFocusTest(visit)
    visit.assertSaysNothingOf(Self.suggestionFailure)
  }

  // MARK: Paused goal

  func testAResumeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let plans = PlanAPIStub()
    await plans.setStatusFails(true)
    let paused = try await PausedToday(in: self, plans: plans)
    try await paused.settle()

    try activate(Self.resume, in: paused.window)
    try await paused.settle()
    XCTAssertTrue(
      paused.says(Self.resumeFailure), "The failure shows: \(spoken(in: paused.window))")

    try await paused.leaveAndComeBack()
    XCTAssertFalse(
      paused.says(Self.resumeFailure), "Nothing of it on return: \(spoken(in: paused.window))")
  }

  /// The Resume that went out before the learner left ends with that visit, so Resume works again
  /// on return instead of spinning.
  func testAResumeThatFailsAfterTheLearnerLeftSaysNothingAndResumesAgainOnReturn() async throws {
    let plans = PlanAPIStub()
    await plans.setStatusFails(true)
    await plans.hold(.setStatus)
    let paused = try await PausedToday(in: self, plans: plans)
    try await paused.settle()

    try activate(Self.resume, in: paused.window)
    await plans.waitForHeldCall()
    try await paused.leave()
    await plans.releaseHeldCall()
    try await paused.settle()
    try await paused.comeBack()
    XCTAssertFalse(
      paused.says(Self.resumeFailure), "Nothing of it on return: \(spoken(in: paused.window))")

    try activate(Self.resume, in: paused.window)
    try await paused.settle()
    let statuses = await plans.calls.statuses
    XCTAssertEqual(statuses, [.active, .active], "Resume asks again")
  }

  // MARK: Helpers

  private static let todayFailure = String(
    localized: "That didn't save. Try again.", table: "Today")
  private static let insightFailure = String(
    localized: "We couldn't save your answer. Try again.", table: "Buddy")
  private static let suggestionFailure = String(
    localized: "That didn't save. Try again.", table: "Plan")
  private static let resume = String(localized: "Resume", table: "Today")
  private static let resumeFailure = String(
    localized: "Couldn't save. Check your connection and try again.", table: "Today")

  /// Today's day in a tab tall enough to draw all of it, its writes failing.
  private func todayVisit(_ view: TodayView, holding: String? = nil) async throws -> PageVisit {
    let visit = try await PageVisit(in: self, goal: .exam, holding: holding) {
      TodayDayView(view: view)
    }
    visit.window.frame = CGRect(x: 0, y: 0, width: 420, height: 1600)
    return visit
  }

  /// The Focus test's sheet, opened again when leaving closed it.
  private func openFocusTest(_ visit: PageVisit) async throws {
    guard visit.window.rootViewController?.presentedViewController == nil else {
      return
    }

    try await visit.activate(String(localized: "View", table: "Plan"))
    try await visit.settle()
    XCTAssertNotNil(
      visit.window.rootViewController?.presentedViewController, "The Focus test's sheet opens")
  }

  private func day(catchUp: Bool = false, notice: TodayView.Notice? = nil, pastDate: Bool = false)
    throws -> TodayView
  {
    func decode<Value: Decodable>(_ json: String) throws -> Value {
      try JSONDecoder().decode(Value.self, from: Data(json.utf8))
    }

    let later =
      #"{"later":{"lessons":3,"minutes":15,"offered":true},"lessonsLeft":3,"positions":[]}"#
    let focusTest: FocusTestSummary.Size? =
      if notice == .focusTest { try decode(#"{"minutes":15}"#) } else { nil }
    let uploadRequest: TodayView.UploadRequest? =
      if notice == .uploadRequest {
        try decode(
          #"{"examDocument":"notice","goalId":"\#(PageServer.goalID)","goalKind":"exam","language":"en","reason":"noOfficialSource"}"#
        )
      } else {
        nil
      }

    return TodayView(
      earlierWork: [], exam: nil, examChoice: nil, focusTest: focusTest,
      goal: try decode(
        #"{"dateEstimated":false,"daysLeft":null,"id":"\#(PageServer.goalID)","kind":"exam","title":"ENEM"}"#
      ),
      insight: notice == .insight
        ? MemoryInsight(
          createdAt: .now, goalId: nil, id: "00000000-0000-4000-8000-000000000011", kind: .tip,
          message: "Review before bed.", planChange: nil, status: .pending, studyTime: nil)
        : nil,
      lessonStatus: [:], mockFunding: nil, notice: notice, pattern: nil, planChange: nil,
      progress: pastDate
        ? TodayView.Progress(
          lessons: nil, measure: "lessons",
          status: TodayView.PlanStatus(
            challenges: nil, days: nil, kind: "pastDate", lessons: nil), value: 0, weekGain: nil)
        : nil,
      session: try decode(
        #"""
        {"blocks":[],"brainPower":0,"catchUp":\#(catchUp ? later : "null"),"current":true,
        "dayEndsAt":1893456000000,"emptyDay":null,"examAccess":{"includesMockExams":true},
        "examTomorrow":false,"extraTime":{"available":false,"lessons":[],"minutes":10,"reason":null},
        "freshStart":null,"fullMeal":{"bonus":50,"earned":false,"ready":false},
        "goalId":"\#(PageServer.goalID)","id":"00000000-0000-4000-8000-000000000051",
        "lessonsComing":false,"lessonsToPrepare":false,"localDate":"2026-11-15",
        "minutes":{"dailyGoal":30,"done":0,"left":30,"planned":30},"missions":[],
        "nextPosition":null,"pauseSuggested":false,"sessionBar":{"completed":0,"total":0},
        "state":"\#(pastDate ? "rest" : "underway")","week":{"days":[],"nextStudyDate":null},"status":"active"}
        """#),
      sourceChange: nil, studiedToday: false, suggestedGoal: nil, uploadRequest: uploadRequest,
      weeklyChallenge: nil)
  }
}

/// Today for a learner whose goal is paused, in a tab, with another tab to leave it for.
@MainActor
private struct PausedToday {
  let window: UIWindow
  private let test: XCTestCase
  private let tabs: PausedTabs

  init(in test: XCTestCase, plans: PlanAPIStub) async throws {
    let dependencies = AppDependencies.hosted()
    let cache = AppCache(session: dependencies.sessionStore)
    let learner = LearnerSummaryStore(api: PausedGoalSummary(), cache: cache)
    await learner.summary.load()
    let tabs = PausedTabs()

    try test.readsWhatVoiceOverReads()
    let window = try test.show(
      PausedTodayHost(tabs: tabs)
        .environment(TodayStore(api: StudyAPIStub(), cache: cache))
        .environment(learner)
        .environment(PlanStore(api: plans, cache: cache))
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    self.window = window
    self.test = test
    self.tabs = tabs
  }

  func says(_ words: String) -> Bool {
    test.spoken(in: window).contains { $0.contains(words) }
  }

  func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }

  func leave() async throws {
    tabs.selected = 1
    try await settle()
  }

  func comeBack() async throws {
    tabs.selected = 0
    try await settle()
  }

  func leaveAndComeBack() async throws {
    try await leave()
    try await comeBack()
  }
}

@MainActor
@Observable
private final class PausedTabs {
  var selected = 0
}

private struct PausedTodayHost: View {
  @Bindable var tabs: PausedTabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        TodayScreen()
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }
}

/// One paused goal, the active one.
private struct PausedGoalSummary: LearnerSummaryAPIClient {
  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: PageServer.goalID,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil,
      goals: [
        LearnerGoal(
          dailyMinutes: 30, id: PageServer.goalID, kind: .exam, language: "en", status: .paused,
          targetDate: "2027-11-14", displayName: "ENEM", title: "ENEM")
      ],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil, nextChangeAt: .distantFuture,
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: true, mindMaps: false,
        readyMistakes: 0, speaking: false),
      readAt: .now, tier: .plus, timeZone: "America/Sao_Paulo", todayBlocksLeft: nil)
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
