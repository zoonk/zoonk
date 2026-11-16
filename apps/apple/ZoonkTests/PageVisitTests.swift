import Foundation
import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// What a chapter, subject, exam or speaking page asked, and how it ended, is the visit's. A failure
/// shown before the learner left is gone when they come back, and one that lands after they left
/// says nothing.
@MainActor
final class PageVisitTests: XCTestCase {
  // MARK: Chapter

  func testAChapterPracticeNoteShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await PageVisit(in: self, goal: .learn) {
      ChapterScreen(chapterId: PageServer.chapterID)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Practice this chapter", table: "Plan"))
    try await visit.settle()
    visit.assertSays(Self.chapterFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.chapterFailure)
  }

  // MARK: Subject

  func testASubjectRestoreFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let visit = try await PageVisit(in: self, goal: .exam) {
      SubjectScreen(subjectKey: PageServer.subjectKey)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Add it back", table: "Plan"))
    try await visit.settle()
    visit.assertSays(Self.subjectFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.subjectFailure)
  }

  func testASubjectRestoreThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let visit = try await PageVisit(in: self, goal: .exam, holding: "createPlanChange") {
      SubjectScreen(subjectKey: PageServer.subjectKey)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Add it back", table: "Plan"))
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.subjectFailure)
  }

  // MARK: Exam date

  func testAnExamDateFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let exam = try PageServer.exam()
    let visit = try await PageVisit(in: self, goal: .exam) {
      ExamList(exam: exam, options: nil)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Use this date", table: "Exam"))
    try await visit.settle()
    visit.assertSays(Self.examFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.examFailure)
  }

  func testAnExamDateThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let exam = try PageServer.exam()
    let visit = try await PageVisit(in: self, goal: .exam, holding: "createPlanChange") {
      ExamList(exam: exam, options: nil)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Use this date", table: "Exam"))
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.examFailure)
  }

  // MARK: Calls

  func testAFailedSpeakingMockStartShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let exam = try PageServer.exam()
    let visit = try await PageVisit(in: self, goal: .exam) {
      ExamList(exam: exam, options: nil)
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Start", table: "Exam"))
    try await visit.settle()
    visit.assertSays(Self.mockFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.mockFailure)
  }

  func testAFailedSpeakingTaskStartShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let router = AppRouter()
    router.speakingTask = PageServer.speakingTask
    let visit = try await PageVisit(in: self, goal: .language, router: router) {
      SpeakingScreen()
    }
    try await visit.settle()

    try await visit.activate(String(localized: "Start", table: "Voice"))
    try await visit.settle()
    visit.assertSays(Self.taskFailure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.taskFailure)
  }

  private static let chapterFailure = String(
    localized: "That didn't work. Try again in a moment.", table: "Plan")
  private static let subjectFailure = chapterFailure
  private static let examFailure = String(
    localized: "That didn't go through. Try again in a moment.", table: "Exam")
  private static let mockFailure = String(
    localized: "The mock didn't start. Try again in a moment.", table: "Exam")
  private static let taskFailure = String(
    localized: "The task didn't start. Try again in a moment.", table: "Voice")
}

/// A page hosted in a tab, with another tab to leave it for, as the app's tabs keep each root.
@MainActor
struct PageVisit {
  let server: PageServer
  let window: UIWindow
  private let test: XCTestCase
  private let tabs: VisitTabs

  /// `holding` names the API operation that waits for `failAfterLeaving()`; every other write fails
  /// at once.
  init<Page: View>(
    in test: XCTestCase, goal kind: LearnerGoal.Kind, holding: String? = nil,
    router: AppRouter = AppRouter(), @ViewBuilder page: @escaping () -> Page
  ) async throws {
    let server = PageServer(holding: holding)
    let tabs = VisitTabs()
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneGoalSummary(kind: kind))
    // The app's shell reads the summary before any page, which takes its goal from it.
    await dependencies.learnerSummaryStore.summary.load()

    try test.readsWhatVoiceOverReads()
    let window = try test.show(
      VisitHost(tabs: tabs, page: page)
        .appDependencies(dependencies)
        .environment(router)
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    self.server = server
    self.tabs = tabs
    self.test = test
    self.window = window
  }

  func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }

  /// Taps what reads `label` once the page has drawn it: a cold simulator under load reads the
  /// page later than a settle.
  func activate(_ label: String) async throws {
    for _ in 0..<50 where !test.spoken(in: window).contains(label) {
      try await Task.sleep(for: .milliseconds(100))
    }

    try test.activate(label, in: window)
  }

  func leaveAndComeBack() async throws {
    tabs.selected = 1
    try await settle()
    tabs.selected = 0
    try await settle()
  }

  /// The held write goes out, the learner leaves, then it fails, and the learner comes back.
  func failAfterLeaving() async throws {
    await server.waitForHeldRequest()
    tabs.selected = 1
    try await settle()
    await server.release()
    try await settle()
    tabs.selected = 0
    try await settle()
  }

  func assertSays(_ words: String, file: StaticString = #filePath, line: UInt = #line) {
    let spoken = test.spoken(in: window)
    XCTAssertTrue(
      spoken.contains { $0.contains(words) }, "It shows: \(spoken)", file: file, line: line)
  }

  func assertSaysNothingOf(_ words: String, file: StaticString = #filePath, line: UInt = #line) {
    let spoken = test.spoken(in: window)
    XCTAssertFalse(
      spoken.contains { $0.contains(words) }, "Nothing of it on return: \(spoken)", file: file,
      line: line)
  }
}

@MainActor
@Observable
private final class VisitTabs {
  var selected = 0
}

private struct VisitHost<Page: View>: View {
  @Bindable var tabs: VisitTabs
  let page: () -> Page

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        page()
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }
}

/// The API behind the pages: their reads answer, and every write fails, the one named `holding`
/// only once `release()` lets it.
actor PageServer: ClientTransport {
  static let goalID = "00000000-0000-4000-8000-000000000001"
  static let chapterID = "00000000-0000-4000-8000-0000000000c1"
  static let subjectKey = "biology"
  static let speakingTask = "t1"

  private var holding: String?
  private var held: CheckedContinuation<Void, Never>?
  private var heldWaiter: CheckedContinuation<Void, Never>?

  init(holding: String?) {
    self.holding = holding
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    if let json = Self.reads[operationID] {
      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(json)
      )
    }

    if operationID == holding {
      holding = nil
      await withCheckedContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    throw APIError.network
  }

  func waitForHeldRequest() async {
    guard held == nil else {
      return
    }

    await withCheckedContinuation { heldWaiter = $0 }
  }

  func release() {
    held?.resume()
    held = nil
  }

  private static let reads = [
    "getGoalChapter": #"""
    {"chapter":{"chapterId":"00000000-0000-4000-8000-0000000000c1","level":"overview","position":1,"state":"current","subject":null,"title":"Cells"},"counts":{"fading":0,"learning":0,"mastered":0,"new":0,"solid":0,"total":0},"goal":{"displayName":"Biology","id":"00000000-0000-4000-8000-000000000001","kind":"learn","title":"Biology"},"lessons":[],"mistakes":{"open":2},"skills":[],"summaries":[],"testOut":{"available":false}}
    """#,
    "getGoalSyllabus": #"""
    {"courseWeights":null,"examDocument":"guide","fromMaterial":false,"goal":{"displayName":"ENEM","id":"00000000-0000-4000-8000-000000000001","kind":"exam","title":"ENEM"},"kind":"notice","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":0},"noticeUrl":null,"passMarks":null,"questionsSource":null,"sharedExams":[],"subjects":[{"areas":["00000000-0000-4000-8000-0000000000a1"],"chapters":[],"displayWeight":null,"group":null,"imageUrl":null,"key":"biology","lessonsDone":0,"lessonsKnown":0,"lessonsTotal":0,"mastery":null,"matrix":[],"name":"Biology","nextDate":null,"notPlannedReason":"skipped","preparation":null,"questions":null,"share":null,"sharedWith":[],"shortName":"Biology","source":"notice","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}],"topicCount":0,"topicsMapped":false,"writtenPractice":null}
    """#,
    "getSpeakingPaper": #"""
    {"exam":"cambridge","language":"en","level":"B2","paper":"Speaking","source":"https://zoonk.test","title":"B2 First","access":"open","minutes":{"max":14,"min":11},"prepMinutes":0,"prepTasks":[],"tasks":[{"key":"t1","minutes":{"max":5,"min":4},"mode":"monologue","name":"Interview","options":0,"prepMinutes":0,"prepShared":null,"role":"examiner","stimulus":"topic","criteria":[],"lastTry":null}]}
    """#,
  ]

  /// An exam months away whose notice moved its likely date, with a speaking mock.
  static func exam() throws -> ExamView {
    try JSONDecoder().decode(
      ExamView.self,
      from: Data(
        #"""
        {"calibration": null, "checklist": [], "cutoff": null, "dayBefore": "learn",
         "days": [{"date": "2027-11-14", "label": null, "startTime": null}],
         "daysEstimated": true, "daysLeft": 364, "estimate": null, "examDocument": "guide",
         "examName": "IELTS", "format": [], "goalId": "00000000-0000-4000-8000-000000000001",
         "map": null, "mocks": [], "mocksRequirePlus": false, "namedMonth": false,
         "nextMock": null, "noSitting": null,
         "noticeDay": {"date": "2027-11-21", "estimated": true}, "passMarks": null,
         "prepared": false, "progress": null, "result": null, "runningMocks": [],
         "scoring": {"method": "irt", "note": null, "noticeScale": null, "rule": null,
                     "scale": null, "stated": false, "wrongPenalty": 0},
         "sessionsDone": 0, "speaking": null, "speakingMock": "ielts", "speakingMockPaused": false,
         "stage": "preparing", "targetScore": null, "timeZone": null, "tools": []}
        """#.utf8))
  }
}

/// One goal of `kind`, the one every page shows.
private struct OneGoalSummary: LearnerSummaryAPIClient {
  let kind: LearnerGoal.Kind

  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: PageServer.goalID,
      analytics: LearnerAnalytics(
        disabled: false, goalKind: nil, plan: "free", planPhase: nil, usageDataSharing: nil,
        username: nil),
      buddy: BuddyLook(), buddyName: nil,
      goals: [
        LearnerGoal(
          dailyMinutes: 15, id: PageServer.goalID, kind: kind, language: "en", status: .active,
          targetDate: nil, displayName: "Biology", title: "Biology")
      ],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil, nextChangeAt: .distantFuture,
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: kind == .exam, mindMaps: false,
        readyMistakes: 0, speaking: true),
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
