import Foundation
import XCTest

@testable import Zoonk

final class ExamChoicePickTests: XCTestCase {
  private let software = "Tecnologia da Informação – Desenvolvimento de Sistemas"

  func testTheRevealSaysTheSpecialtyThePlanFollowsByItsShortName() throws {
    let choice = try specialty(subject: software)

    XCTAssertEqual(choice.pickedName, "Desenvolvimento de Sistemas")
    XCTAssertEqual(choice.followingLine, "Following the Desenvolvimento de Sistemas syllabus")
  }

  func testAnOptionWithoutAShortNameIsNamedInFull() throws {
    XCTAssertEqual(try specialty(subject: "Auditoria").pickedName, "Auditoria")
  }

  func testAChoiceLeftForLaterOrNoLongerOfferedSaysNothingItFollows() throws {
    XCTAssertNil(try specialty(subject: nil).followingLine)
    XCTAssertNil(try specialty(subject: "Controle Interno").pickedName)
  }

  func testTheQuestionSaysWhatTheNoticeOffers() throws {
    let one = try questionChoices(groups: ["Especialidade"])
    let two = try questionChoices(groups: ["Historia", "Lengua Extranjera II"])

    XCTAssertEqual(
      examChoiceQuestionDescription(one),
      "The exam offers 2 options for Especialidade. Your plan and mocks follow the one you pick, and you can change it in your plan."
    )
    XCTAssertEqual(
      examChoiceQuestionDescription(two),
      "The exam has 2 choices to make. Your plan and mocks follow your picks, and you can change them in your plan."
    )
  }

  private func choiceJSON(group: String, subject: String?) -> String {
    let picked = subject.map { "\"\($0)\"" } ?? "null"

    return """
      {"group":"\(group)","subject":\(picked),
       "options":[{"name":"Auditoria","shortName":null},
                  {"name":"\(software)","shortName":"Desenvolvimento de Sistemas"}],
       "leftOut":{"examPoints":360,"examQuestions":null,"name":"Conhecimentos específicos (P3)",
                  "points":180,"questions":null}}
      """
  }

  private func specialty(subject: String?) throws -> GoalPlan.ExamChoice {
    try JSONDecoder().decode(
      GoalPlan.ExamChoice.self,
      from: Data(choiceJSON(group: "Especialidade", subject: subject).utf8))
  }

  private func questionChoices(groups: [String]) throws -> [Components.Schemas.ExamChoice] {
    let json = "[\(groups.map { choiceJSON(group: $0, subject: nil) }.joined(separator: ","))]"
    return try JSONDecoder().decode([Components.Schemas.ExamChoice].self, from: Data(json.utf8))
  }
}
