import Foundation
import XCTest

@testable import Zoonk

final class ExamChoiceLeftOutTests: XCTestCase {
  func testAChoiceSaysThePointsItLeavesOutWhenTheNoticeGivesThem() {
    XCTAssertEqual(
      leftOut(points: 90, examPoints: 260, questions: 60, examQuestions: 180).line,
      "Until you pick, your plan and mocks leave out Conhecimentos específicos (P3): 90 of the exam's 260 points."
    )
  }

  func testWithoutPointsItSaysTheQuestions() {
    XCTAssertEqual(
      leftOut(questions: 60, examQuestions: 180).line,
      "Until you pick, your plan and mocks leave out Conhecimentos específicos (P3): 60 of the exam's 180 questions."
    )
    XCTAssertEqual(
      leftOut(questions: 1).line,
      "Until you pick, your plan and mocks leave out Conhecimentos específicos (P3): 1 question.")
    XCTAssertEqual(
      leftOut(questions: 60).line,
      "Until you pick, your plan and mocks leave out Conhecimentos específicos (P3): 60 questions.")
  }

  func testWithoutCountsItNamesWhatItLeavesOut() {
    XCTAssertEqual(
      leftOut().line,
      "Until you pick, your plan and mocks leave out Conhecimentos específicos (P3).")
  }

  func testThePlansChoicesReadWhatTheyLeaveOut() throws {
    let json = #"""
      {"group":"Especialidade","subject":null,
       "options":[{"name":"Auditoria e Fiscalização","shortName":null}],
       "leftOut":{"examPoints":260,"examQuestions":180,"name":"Conhecimentos específicos (P3)",
                  "points":90,"questions":60}}
      """#

    let choice = try JSONDecoder().decode(GoalPlan.ExamChoice.self, from: Data(json.utf8))

    XCTAssertEqual(
      choice.leftOut,
      leftOut(points: 90, examPoints: 260, questions: 60, examQuestions: 180))
  }

  private func leftOut(
    points: Int? = nil, examPoints: Int? = nil, questions: Int? = nil, examQuestions: Int? = nil
  ) -> ExamChoiceLeftOut {
    ExamChoiceLeftOut(
      examPoints: examPoints, examQuestions: examQuestions,
      name: "Conhecimentos específicos (P3)", points: points, questions: questions)
  }
}
