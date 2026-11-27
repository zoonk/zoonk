import Foundation
import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// A page hosted in a tab, with another tab to leave it for, as the app's tabs keep each root.
@MainActor
struct PageVisit {
  let server: PageServer
  let window: UIWindow
  private let test: XCTestCase
  private let tabs: VisitTabs

  /// `holding` names the API operation that waits for the server's `release()`; every other write
  /// fails at once.
  init<Page: View>(
    in test: XCTestCase, goal kind: LearnerGoal.Kind, holding: String? = nil,
    @ViewBuilder page: @escaping () -> Page
  ) async throws {
    let server = PageServer(holding: holding)
    let tabs = VisitTabs()
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneGoalSummary(kind: kind))
    // The app's shell reads the summary before any page, which takes its goal from it.
    await dependencies.learnerSummaryStore.summary.load()

    try await test.readsWhatVoiceOverReads()
    let window = try test.show(
      VisitHost(tabs: tabs, page: page)
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    self.server = server
    self.tabs = tabs
    self.test = test
    self.window = window
  }

  /// Taps what reads `label` once the page has drawn it: a cold simulator under load reads the
  /// page later than a settle.
  func activate(_ label: String) async throws {
    try await test.activate(label, in: window)
  }

  func leaveAndComeBack() async throws {
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && test.spoken(in: window).contains("Elsewhere")
    }
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && !test.spoken(in: window).contains("Elsewhere")
    }
  }
}

@MainActor
@Observable
private final class VisitTabs {
  var selected = 0
  var pageVisible = false
}

private struct VisitHost<Page: View>: View {
  @Bindable var tabs: VisitTabs
  let page: () -> Page

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        page()
          .onAppear { tabs.pageVisible = true }
          .onDisappear { tabs.pageVisible = false }
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }
}

/// The API behind the pages: reads answer, and writes fail. The one named `holding` waits until
/// `release()` lets it.
actor PageServer: ClientTransport {
  static let goalID = "00000000-0000-4000-8000-000000000001"
  static let subjectKey = "biology"

  private(set) var writes: [String] = []
  private var completedWrites = 0
  private var holding: String?
  private var held: TestContinuation<Void>?

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

    defer { completedWrites += 1 }
    writes.append(operationID)
    if operationID == holding {
      holding = nil
      await withTestVoidContinuation { continuation in
        held = continuation
      }
    }
    throw APIError.network
  }

  func waitForHeldRequest(file: StaticString = #filePath, line: UInt = #line) async throws {
    try await waitForTestCondition("The fixture never received its request", file: file, line: line)
    { await self.isHeld }
  }

  private var isHeld: Bool { held != nil }

  func release() async throws {
    let before = completedWrites
    held?.resume()
    held = nil
    try await waitForTestCondition("The released response never completed") {
      await self.completedWrites > before
    }
  }

  private static let reads = [
    "listMocks": #"""
    {"access":"open","examDocument":"guide","examName":"ENEM","goalId":"00000000-0000-4000-8000-000000000001","lastMock":null,"options":[{"area":null,"areas":[],"covers":[],"day":null,"estimatedMinutes":30,"kind":"full","leftOut":[],"minutes":60,"objectiveOnly":true,"questions":20,"written":[]},{"availability":{"status":"needsChoice","choiceGroups":["Specialty area"]},"area":null,"areas":[],"covers":[],"day":null,"estimatedMinutes":30,"kind":"written","leftOut":[],"minutes":60,"objectiveOnly":false,"questions":0,"written":["Written test"]}],"requested":null,"running":null,"sizeSource":{"formats":null,"material":false,"pastEdition":null,"questions":"notice","subjects":null,"time":"notice"}}
    """#,

    "getGoalSyllabus": #"""
    {"courseWeights":null,"examDocument":"guide","fromMaterial":false,"goal":{"displayName":"ENEM","id":"00000000-0000-4000-8000-000000000001","kind":"exam","title":"ENEM"},"kind":"notice","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":0},"noticeUrl":null,"passMarks":null,"questionsSource":null,"sharedExams":[],"subjects":[{"areas":["00000000-0000-4000-8000-0000000000a1"],"chapters":[],"covers":[],"displayWeight":null,"group":null,"imageUrl":null,"key":"biology","lessonsDone":0,"lessonsKnown":0,"lessonsTotal":0,"mastery":null,"matrix":[],"name":"Biology","nextDate":null,"notPlannedReason":"skipped","preparation":null,"questions":null,"share":null,"sharedWith":[],"shortName":"Biology","source":"notice","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}],"topicCount":0,"topicsMapped":false,"writtenPractice":null}
    """#,
  ]
}

/// One goal of `kind`, the one every page shows.
struct OneGoalSummary: LearnerSummaryAPIClient {
  let kind: LearnerGoal.Kind
  var level: LearnerLevel? = nil

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
      level: level, nextChangeAt: .distantFuture,
      places: LearnerPlaces(
        certificates: false, completedLessons: false, exam: kind == .exam, mindMaps: false,
        readyMistakes: 0, savedLessons: false, speaking: true),
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
