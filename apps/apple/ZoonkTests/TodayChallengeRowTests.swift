import XCTest

@testable import Zoonk

final class TodayChallengeRowTests: XCTestCase {
  private func challenge(
    subject: String? = nil, phase: String? = "Motion", questions: Int = 8, kind: String = "phase",
    mock: Bool = false
  ) throws -> StudyBlock {
    let json = """
      {"id": null, "areaId": null, "brainPower": 0, "canDo": null, "canTestOut": false,
       "capsules": [], "chapterId": null,
       "checkpoint": {"kind": "\(kind)", "mock": \(mock), "mockIdentity": null, "phase": 1,
                      "rematch": false},
       "estimatedMinutes": 10, "extra": false, "fullReview": false, "kind": "checkpoint",
       "lessonId": null, "mistakesOnly": false, "oftenTested": false, "planItemId": null,
       "planItemKey": null, "position": 2, "questions": \(questions), "refresh": false,
       "reinforcement": false, "screen": "challenge", "status": "pending",
       "subject": \(subject.map { "\"\($0)\"" } ?? "null"),
       "title": \(phase.map { "\"\($0)\"" } ?? "null"), "waitReason": null, "weakest": false}
      """
    return try JSONDecoder().decode(StudyBlock.self, from: Data(json.utf8))
  }

  func testAChallengeSaysItsPhaseQuestionsAndNoHints() throws {
    XCTAssertEqual(
      try challenge().label(isCatchingUp: false), "Motion · 8 questions, no hints")
    XCTAssertEqual(
      try challenge(subject: "Physics").label(isCatchingUp: false),
      "Physics · Motion · 8 questions, no hints")
  }

  func testALanguageCallNeverReadsZeroQuestions() throws {
    XCTAssertEqual(
      try challenge(phase: "At the airport", questions: 0).label(isCatchingUp: false),
      "At the airport · a live call")
    XCTAssertEqual(
      try challenge(phase: nil, questions: 0).label(isCatchingUp: false), "A live call")
  }

  func testAWeeklyChallengeHasNoPhase() throws {
    XCTAssertEqual(
      try challenge(kind: "weekly").label(isCatchingUp: false), "8 questions, no hints")
  }
}
