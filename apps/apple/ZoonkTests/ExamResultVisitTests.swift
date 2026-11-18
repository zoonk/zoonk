import SwiftUI
import XCTest

@testable import Zoonk

/// Saving the exam's official result is the visit's: a failure shown before the learner left is
/// gone when they come back, and one that lands after they left says nothing.
@MainActor
final class ExamResultVisitTests: XCTestCase {
  func testAResultSaveFailureShownBeforeTheLearnerLeftIsGoneOnReturn() async throws {
    let exam = try Self.examTaken()
    let visit = try await PageVisit(in: self, goal: .exam) {
      ExamList(exam: exam, options: nil)
    }

    try await save(in: visit)
    try await visit.assertSays(Self.failure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.failure)
  }

  func testAResultSaveThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let exam = try Self.examTaken()
    let visit = try await PageVisit(in: self, goal: .exam, holding: "reportExamResult") {
      ExamList(exam: exam, options: nil)
    }

    try await save(in: visit)
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.failure)
  }

  private static let failure = String(
    localized: "That didn't go through. Try again in a moment.", table: "Exam")

  /// Enters a score in the field on screen and taps Save once the form has it. SwiftUI hears the
  /// field's edits only through its editing-changed event, so this sets the text and sends that
  /// event, as a keyboard's edit does, rather than trusting `insertText` to send it. A list keeps
  /// cells it took off screen, hidden, for reuse, so only a field with nothing hidden above it is
  /// the one the learner sees.
  private func save(in visit: PageVisit) async throws {
    var shown: [UITextField] = []
    try await waitForTestCondition("The score field did not appear") {
      shown = requestViews(UITextField.self, in: visit.window).filter { field in
        !sequence(first: field as UIView, next: \.superview).contains {
          $0.isHidden || $0.alpha < 0.01
        }
      }
      return !shown.isEmpty
    }
    XCTAssertEqual(shown.count, 1, "One score field on screen")
    let field = try XCTUnwrap(shown.first)
    field.text = "700"
    field.sendActions(for: .editingChanged)
    try await visit.activate(String(localized: "Save my result", table: "Exam"))
  }

  /// The exam is over and its result isn't in yet.
  private static func examTaken() throws -> ExamView {
    try JSONDecoder().decode(
      ExamView.self,
      from: Data(
        #"""
        {"calibration": null, "checklist": [], "cutoff": null, "dayBefore": "learn",
         "days": [{"date": "2026-11-08", "label": null, "startTime": null}],
         "daysEstimated": false, "daysLeft": 0, "estimate": null, "examDocument": "guide",
         "examName": "ENEM", "format": [], "goalId": "00000000-0000-4000-8000-000000000001",
         "map": null, "mocks": [], "mocksRequirePlus": false, "namedMonth": false,
         "nextMock": null, "noSitting": null, "noticeDay": null, "passMarks": null,
         "prepared": false, "progress": null, "result": null, "runningMocks": [],
         "scoring": {"method": "irt", "note": null, "noticeScale": null, "rule": null,
                     "scale": null, "stated": false, "wrongPenalty": 0},
         "sessionsDone": 0, "speaking": null, "speakingMock": null, "speakingMockPaused": false,
         "stage": "afterExam", "targetScore": null, "timeZone": null, "tools": []}
        """#.utf8))
  }
}
