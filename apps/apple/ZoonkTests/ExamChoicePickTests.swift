import Foundation
import XCTest

@testable import Zoonk

final class ExamChoicePickTests: XCTestCase {
  private let software = "Tecnologia da Informação – Desenvolvimento de Sistemas"
  private let modules = ["Biología", "Derecho", "Premedicina", "Química"]

  func testTheRevealSaysTheSpecialtyThePlanFollowsByItsShortName() throws {
    let choice = try specialty(subjects: [software])

    XCTAssertEqual(choice.pickedNames, "Desenvolvimento de Sistemas")
    XCTAssertEqual(choice.followingLine, "Following the Desenvolvimento de Sistemas syllabus")
  }

  func testAnOptionWithoutAShortNameIsNamedInFull() throws {
    XCTAssertEqual(try specialty(subjects: ["Auditoria"]).pickedNames, "Auditoria")
  }

  func testSeveralPicksAreListedInTheNoticesOrder() throws {
    let choice = try specialty(subjects: [software, "Auditoria"])

    XCTAssertEqual(choice.pickedNames, "Auditoria and Desenvolvimento de Sistemas")
    XCTAssertEqual(
      choice.followingLine, "Following the Auditoria and Desenvolvimento de Sistemas syllabus")
  }

  func testAChoiceLeftForLaterOrNoLongerOfferedSaysNothingItFollows() throws {
    XCTAssertNil(try specialty(subjects: []).followingLine)
    XCTAssertNil(try specialty(subjects: ["Controle Interno"]).pickedNames)
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

  func testTheQuestionSaysHowManyOptionsACandidateTakes() throws {
    let modules = try questionChoices(groups: ["Módulos disciplinares"], take: 2)

    XCTAssertEqual(
      examChoiceQuestionDescription(modules),
      "The exam offers 2 options for Módulos disciplinares, and each candidate takes 2 of them. Your plan and mocks follow the ones you pick, and you can change them in your plan."
    )
  }

  func testPicksStayInTheNoticesOrderUpToTheTake() {
    var picks = ExamOptionPicks(options: modules, take: 2, names: [])

    picks.set("Química", picked: true)
    picks.set("Biología", picked: true)
    XCTAssertEqual(picks.names, ["Biología", "Química"])

    picks.set("Derecho", picked: true)
    XCTAssertEqual(picks.names, ["Biología", "Química"])
    XCTAssertFalse(picks.canPick("Derecho"))
    XCTAssertTrue(picks.canPick("Química"))

    picks.set("Química", picked: false)
    XCTAssertTrue(picks.canPick("Derecho"))
    picks.set("Derecho", picked: true)
    XCTAssertEqual(picks.names, ["Biología", "Derecho"])
  }

  func testATakeOfOneHoldsOneOptionAtATime() {
    var picks = ExamOptionPicks(options: modules, take: 1, names: ["Premedicina"])

    picks.set("Biología", picked: true)
    XCTAssertEqual(picks.names, ["Premedicina"])
  }

  func testSavingNeedsAPickThatIsNotTheSavedOne() {
    let saved = ["Biología", "Química"]

    XCTAssertFalse(ExamOptionPicks(options: modules, take: 2, names: []).canSave(over: []))
    XCTAssertTrue(ExamOptionPicks(options: modules, take: 2, names: ["Derecho"]).canSave(over: []))
    XCTAssertFalse(
      ExamOptionPicks(options: modules, take: 2, names: ["Química", "Biología"]).canSave(
        over: saved))
    XCTAssertTrue(
      ExamOptionPicks(options: modules, take: 2, names: ["Biología"]).canSave(over: saved))
  }

  private func choiceJSON(group: String, subjects: [String], take: Int = 1) throws -> String {
    let picked = String(decoding: try JSONEncoder().encode(subjects), as: UTF8.self)

    return """
      {"group":"\(group)","subjects":\(picked),"take":\(take),
       "options":[{"name":"Auditoria","shortName":null},
                  {"name":"\(software)","shortName":"Desenvolvimento de Sistemas"}],
       "leftOut":{"examPoints":360,"examQuestions":null,"name":"Conhecimentos específicos (P3)",
                  "points":180,"questions":null}}
      """
  }

  private func specialty(subjects: [String]) throws -> GoalPlan.ExamChoice {
    try JSONDecoder().decode(
      GoalPlan.ExamChoice.self,
      from: Data(try choiceJSON(group: "Especialidade", subjects: subjects).utf8))
  }

  private func questionChoices(groups: [String], take: Int = 1) throws
    -> [Components.Schemas.ExamChoice]
  {
    let json = try
      "[\(groups.map { try choiceJSON(group: $0, subjects: [], take: take) }.joined(separator: ","))]"
    return try JSONDecoder().decode([Components.Schemas.ExamChoice].self, from: Data(json.utf8))
  }
}
