import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// The exam page's note on its estimated dates, open while the window crosses the width where the
/// mocks are a pane beside the page: the note stays open.
@MainActor
final class ExamDateNoteTests: XCTestCase {
  func testLastExamActionClearsTheTabBar() async throws {
    let window = try await showExamDay()

    let action = try speakingMockAction(in: window)
    let tabBar = try XCTUnwrap(requestViews(UITabBar.self, in: window).first)
    let tabBarFrame = tabBar.convert(tabBar.bounds, to: nil)
    XCTAssertLessThanOrEqual(
      action.accessibilityFrame.maxY, tabBarFrame.minY,
      "The speaking mock action should be reachable when the exam opens")
  }

  func testAFailedSpeakingMockStartSaysSoAboveItsAction() async throws {
    let window = try await showExamDay()

    try await activate("Start", in: window)

    let failure = "The mock didn't start. Try again in a moment."
    try await waitForTestCondition("The failure never showed: \(spoken(in: window))") {
      accessibilityElements(in: window).contains { $0.accessibilityLabel == failure }
    }
    let line = try XCTUnwrap(
      accessibilityElements(in: window).first { $0.accessibilityLabel == failure })
    let action = try speakingMockAction(in: window)
    XCTAssertLessThanOrEqual(line.accessibilityFrame.maxY, action.accessibilityFrame.minY)
    XCTAssertLessThan(
      action.accessibilityFrame.minY - line.accessibilityFrame.maxY, 44,
      "The failure should sit just above the action that failed")
  }

  func testAGuestAtTheCallLimitIsOfferedAnAccountInTheBar() async throws {
    let window = try await showExamDay(transport: GuestCallLimit())

    try await activate("Start", in: window)

    let signUp = String(localized: "Create a free account", table: "Subscriptions")
    try await waitForTestCondition("No way on: \(spoken(in: window))") {
      self.accessibilityElements(in: window).contains {
        $0.accessibilityLabel == signUp && $0.accessibilityTraits.contains(.button)
      }
    }
  }

  private func speakingMockAction(in window: UIWindow) throws -> NSObject {
    try XCTUnwrap(
      accessibilityElements(in: window).first {
        $0.accessibilityLabel == "Start" && $0.accessibilityTraits.contains(.button)
      })
  }

  private func showExamDay(transport: any ClientTransport = OfflineTransport()) async throws
    -> UIWindow
  {
    var exam = try Self.exam()
    exam.stage = .examDay
    exam.daysEstimated = false
    exam.days = [.init(date: "2026-11-17", label: nil, startTime: "13:30")]
    exam.daysLeft = 0
    exam.examName = "IELTS"
    exam.noticeDay = .init(date: "2027-11-21", estimated: true)
    exam.sessionsDone = 10
    exam.prepared = true
    exam.speakingMock = .ielts
    let dependencies = AppDependencies.hosted(transport: transport)
    try readsWhatVoiceOverReads()

    let window = try show(
      TabView {
        Tab("Today", systemImage: "sun.max") {
          NavigationStack {
            ExamList(exam: exam, options: nil)
          }
        }
        Tab("Plan", systemImage: "list.bullet") { Color.clear }
        Tab("Search", systemImage: "magnifyingglass", role: .search) { Color.clear }
      }
      .tabViewStyle(.sidebarAdaptable)
      .appDependencies(dependencies)
      .environment(AppRouter())
      .zoonkStyles())
    try await waitForLayout(in: window)
    return window
  }

  func testEstimatedExamDaysReadAsAboutADay() async throws {
    try readsWhatVoiceOverReads()
    let exam = try Self.exam()
    let window = try show(
      NavigationStack {
        ExamList(exam: exam, options: nil)
      }
      .appDependencies(AppDependencies.hosted())
      .environment(AppRouter())
      .zoonkStyles())
    try await waitForLayout(in: window)

    try await waitForTestCondition("The exam's facts never showed: \(spoken(in: window))") {
      self.spoken(in: window).contains { $0.hasPrefix("About ") }
    }
    XCTAssertTrue(
      spoken(in: window).contains { $0.contains("About 364 days left") },
      "An estimated date's days left read as about: \(spoken(in: window))")
    XCTAssertFalse(
      spoken(in: window).contains { $0.contains("~") }, "Read as written: \(spoken(in: window))")
  }

  func testTheDateNoteStaysWhenTheMocksPaneGoes() async throws {
    try await staysOpen(from: 1376, to: 420)
  }

  func testTheDateNoteStaysWhenTheMocksPaneComes() async throws {
    try await staysOpen(from: 420, to: 1376)
  }

  private func staysOpen(from: CGFloat, to: CGFloat) async throws {
    let dependencies = AppDependencies.hosted()
    let exam = try Self.exam()
    try readsWhatVoiceOverReads()

    let window = try show(
      NavigationStack {
        ExamList(exam: exam, options: nil)
      }
      .appDependencies(dependencies)
      .environment(AppRouter())
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await waitForLayout(in: window)

    try await activate(String(localized: "Estimated dates", table: "Exam"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      (window.rootViewController?.presentedViewController) != nil
    }
    XCTAssertNotNil(window.rootViewController?.presentedViewController, "The note opens")

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await waitForLayout(in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      (window.rootViewController?.presentedViewController) != nil
    }
    XCTAssertNotNil(window.rootViewController?.presentedViewController, "The note stays")
  }

  private static func exam() throws -> ExamView {
    try JSONDecoder().decode(
      ExamView.self,
      from: Data(
        #"""
        {"calibration": null, "checklist": [], "cutoff": null, "dayBefore": "learn",
         "days": [{"date": "2027-11-14", "label": null, "startTime": null}],
         "daysEstimated": true, "daysLeft": 364, "estimate": null, "examDocument": "guide",
         "examName": "ENEM", "format": [], "goalId": "00000000-0000-4000-8000-000000000001",
         "map": null, "mocks": [], "mocksRequirePlus": false, "namedMonth": false,
         "nextMock": null, "noSitting": null, "noticeDay": null, "passMarks": null,
         "prepared": false, "progress": null, "result": null, "runningMocks": [],
         "scoring": {"method": "irt", "note": null, "noticeScale": null, "rule": null,
                     "scale": null, "stated": false, "wrongPenalty": 0},
         "sessionsDone": 0, "speaking": null, "speakingMock": null, "speakingMockPaused": false,
         "stage": "preparing", "targetScore": null, "timeZone": null, "tools": []}
        """#.utf8))
  }

}

/// A guest's call is refused at their limit.
private struct GuestCallLimit: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard operationID == "startLanguageConversation" else {
      throw APIError.network
    }

    return (
      HTTPResponse(status: .tooManyRequests, headerFields: [.contentType: "application/json"]),
      HTTPBody(
        #"{"error":{"code":"CONVERSATION_LIMIT_REACHED","message":"Limit","details":{"limit":{"period":"total","tier":"guest"}}}}"#
      )
    )
  }
}
