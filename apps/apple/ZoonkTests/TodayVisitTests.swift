import SwiftUI
import XCTest

@testable import Zoonk

/// What Today asked belongs to the visit: coming back while it saves sends nothing twice, and a
/// request that failed after the learner left leaves its button working on return.
@MainActor
final class TodayVisitTests: XCTestCase {
  func testReturningWhileKeepStudyingSavesDoesNotSendAnotherChange() async throws {
    let visit = try await todayVisit(try pastDateDay(), holding: "createPlanChange")
    let label = String(localized: "Keep studying", table: "Plan")
    try await visit.activate(label)
    try await visit.server.waitForHeldRequest()
    try await visit.leaveAndComeBack()
    if spoken(in: visit.window).contains(label) {
      try await activate(label, in: visit.window)
    }
    try await visit.server.release()
    let changes = await visit.server.writes.filter { $0 == "createPlanChange" }
    XCTAssertEqual(changes.count, 1)
  }

  /// The Resume that went out before the learner left ends with that visit, so Resume works again
  /// on return instead of spinning.
  func testAResumeThatFailsAfterTheLearnerLeftSaysNothingAndResumesAgainOnReturn() async throws {
    let plans = PlanAPIStub()
    await plans.setStatusFails(true)
    await plans.hold(.setStatus)
    let paused = try await PausedToday(in: self, plans: plans)

    try await activate(Self.resume, in: paused.window)
    try await plans.waitForHeldCall()
    try await paused.leave()
    await plans.releaseHeldCall()
    try await paused.comeBack()
    XCTAssertFalse(
      paused.says(Self.resumeFailure), "Nothing of it on return: \(spoken(in: paused.window))")

    try await activate(Self.resume, in: paused.window)
    try await waitForTestCondition("Resume was not sent again") {
      await plans.calls.statuses.count == 2
    }
    let statuses = await plans.calls.statuses
    XCTAssertEqual(statuses, [.active, .active], "Resume asks again")
  }

  private static let resume = String(localized: "Resume", table: "Today")
  private static let resumeFailure = String(
    localized: "Couldn't save. Check your connection and try again.", table: "Today")

  /// Today's day in a tab tall enough to draw all of it.
  private func todayVisit(_ view: TodayView, holding: String? = nil) async throws -> PageVisit {
    let visit = try await PageVisit(in: self, goal: .exam, holding: holding) {
      TodayDayView(view: view)
    }
    visit.window.frame = CGRect(x: 0, y: 0, width: 420, height: 1600)
    return visit
  }

  /// An exam day whose date has passed, so Today offers Keep studying.
  private func pastDateDay() throws -> TodayView {
    func decode<Value: Decodable>(_ json: String) throws -> Value {
      try JSONDecoder().decode(Value.self, from: Data(json.utf8))
    }

    return TodayView(
      earlierWork: [], exam: nil, examChoice: nil, focusTest: nil,
      goal: try decode(
        #"{"dateEstimated":false,"daysLeft":null,"id":"\#(PageServer.goalID)","kind":"exam","title":"ENEM"}"#
      ),
      insight: nil, lessonStatus: [:], mockFunding: nil, notice: nil, pattern: nil,
      planChange: nil,
      progress: TodayView.Progress(
        lessons: nil, measure: "lessons",
        status: TodayView.PlanStatus(challenges: nil, days: nil, kind: "pastDate", lessons: nil),
        value: 0, weekGain: nil),
      session: try decode(
        #"""
        {"blocks":[],"brainPower":0,"catchUp":null,"current":true,
        "dayEndsAt":1893456000000,"emptyDay":null,"examAccess":{"includesMockExams":true},
        "examTomorrow":false,"extraTime":{"available":false,"lessons":[],"minutes":10,"reason":null},
        "freshStart":null,"fullMeal":{"bonus":50,"earned":false,"ready":false},
        "goalId":"\#(PageServer.goalID)","id":"00000000-0000-4000-8000-000000000051",
        "lessonsComing":false,"lessonsToPrepare":false,"localDate":"2026-11-15",
        "minutes":{"dailyGoal":30,"done":0,"left":30,"planned":30},"missions":[],
        "nextPosition":null,"pauseSuggested":false,"sessionBar":{"completed":0,"total":0},
        "state":"rest","week":{"days":[],"nextStudyDate":null},"status":"active"}
        """#),
      sourceChange: nil, studiedToday: false, suggestedGoal: nil, uploadRequest: nil,
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

    try await test.readsWhatVoiceOverReads()
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

  func leave() async throws {
    tabs.selected = 1
    try await waitForTestCondition("Left Today") { !tabs.pageVisible && says("Elsewhere") }
  }

  func comeBack() async throws {
    tabs.selected = 0
    try await waitForTestCondition("Returned to Today") { tabs.pageVisible && !says("Elsewhere") }
  }
}

@MainActor
@Observable
private final class PausedTabs {
  var selected = 0
  var pageVisible = false
}

private struct PausedTodayHost: View {
  @Bindable var tabs: PausedTabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        TodayScreen()
          .onAppear { tabs.pageVisible = true }
          .onDisappear { tabs.pageVisible = false }
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
        readyMistakes: 0, savedLessons: false, speaking: false),
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
