import SwiftUI
import XCTest

@testable import Zoonk

/// The exam page's note on its estimated dates, open while the window crosses the width where the
/// mocks are a pane beside the page: the note stays open.
@MainActor
final class ExamDateNoteTests: XCTestCase {
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
    try await settle()

    try activate(String(localized: "Estimated dates", table: "Exam"), in: window)
    try await settle()
    XCTAssertNotNil(window.rootViewController?.presentedViewController, "The note opens")

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await settle()

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

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }

}
