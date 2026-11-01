import XCTest

@testable import Zoonk

final class TodayPracticeRowTests: XCTestCase {
  private func practice(areas: [String] = ["Math", "Languages"], extra: Bool = false) throws
    -> StudyBlock
  {
    let topics = ["Functions", "Percentages"] + (1...8).map { "Topic \($0)" }

    let json = """
      {"id": null, "areaId": null, "areas": [\(areas.map { "\"\($0)\"" }.joined(separator: ", "))], "brainPower": 0, "canDo": null,
       "canTestOut": false, "capsules": [], "chapterId": null, "checkpoint": null,
       "estimatedMinutes": 15, "extra": \(extra), "fullReview": false, "kind": "practice",
       "lessonId": null, "mistakesOnly": false, "oftenTested": false, "planItemId": null,
       "planItemKey": null, "position": 1, "questions": 10, "refresh": false,
       "reinforcement": false, "screen": "session", "status": "pending", "subject": null,
       "title": null,
       "topics": [\(topics.map { "\"\($0)\"" }.joined(separator: ", "))],
       "waitReason": null, "weakest": false}
      """

    return try JSONDecoder().decode(StudyBlock.self, from: Data(json.utf8))
  }

  func testAPracticeBlockIsNamedAfterTheAreasMostOfItAsksAbout() throws {
    XCTAssertEqual(try practice().displayTitle, "Practice: Math and Languages")
    XCTAssertEqual(try practice(extra: true).displayTitle, "Bonus practice: Math and Languages")
    XCTAssertEqual(try practice(areas: []).displayTitle, "Mixed practice")
  }

  func testAPracticeBlockSaysWhatItPractises() throws {
    XCTAssertEqual(try practice().label(isCatchingUp: false), "Functions and 9 more")
    XCTAssertEqual(try practice().detail, "10 questions\u{A0}· Functions, Percentages and 8 more")
  }
}
