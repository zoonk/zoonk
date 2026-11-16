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
    try await visit.settle()

    try await save(in: visit)
    try await visit.settle()
    visit.assertSays(Self.failure)

    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(Self.failure)
  }

  func testAResultSaveThatFailsAfterTheLearnerLeftSaysNothingOnReturn() async throws {
    let exam = try Self.examTaken()
    let visit = try await PageVisit(in: self, goal: .exam, holding: "reportExamResult") {
      ExamList(exam: exam, options: nil)
    }
    try await visit.settle()

    try await save(in: visit)
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(Self.failure)
  }

  private static let failure = String(
    localized: "That didn't go through. Try again in a moment.", table: "Exam")

  /// Types a score, as the keyboard does, and taps Save.
  private func save(in visit: PageVisit) async throws {
    let field = try XCTUnwrap(textField(in: visit.window), "No score field")
    field.becomeFirstResponder()
    field.insertText("700")
    try await visit.settle()
    try visit.activate(String(localized: "Save my result", table: "Exam"))
  }

  private func textField(in view: UIView) -> UITextField? {
    if let field = view as? UITextField {
      return field
    }

    return view.subviews.lazy.compactMap { self.textField(in: $0) }.first
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
