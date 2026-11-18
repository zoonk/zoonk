import SwiftUI
import XCTest

@testable import Zoonk

/// The exam page's note on its estimated dates, open while the window crosses the width where the
/// mocks are a pane beside the page: the note stays open.
@MainActor
final class ExamDateNoteTests: XCTestCase {
  func testLastExamActionClearsTheTabBar() async throws {
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
    let dependencies = AppDependencies.hosted()
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

    let action = try XCTUnwrap(
      accessibilityElements(in: window).first {
        $0.accessibilityLabel == "Start" && $0.accessibilityTraits.contains(.button)
      })
    let tabBar = try XCTUnwrap(requestViews(UITabBar.self, in: window).first)
    let tabBarFrame = tabBar.convert(tabBar.bounds, to: nil)
    XCTAssertLessThanOrEqual(
      action.accessibilityFrame.maxY, tabBarFrame.minY,
      "The speaking mock action should be reachable when the exam opens")
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
