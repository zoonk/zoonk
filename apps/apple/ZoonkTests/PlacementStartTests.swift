import XCTest

@testable import Zoonk

final class PlacementStartTests: XCTestCase {
  func testStartShowsQuestionsThatAlreadyExist() throws {
    let started = PlacementStep.Phase(started: try placement(.asking))

    guard case .question(let question, let labels) = started else {
      return XCTFail("Start showed \(started) instead of the question")
    }

    XCTAssertEqual(question.itemId, Self.itemID)
    XCTAssertEqual(labels, .trueFalse)
  }

  func testStartWaitsOnlyWhileTheQuestionsAreWritten() throws {
    XCTAssertEqual(PlacementStep.Phase(started: try placement(.preparing)), .waiting(failure: nil))
    XCTAssertEqual(
      PlacementStep.Phase(started: try placement(.waitingForQuestions)), .waiting(failure: nil))
  }

  func testStartShowsTheEndWhenNothingIsLeftToAsk() throws {
    XCTAssertEqual(PlacementStep.Phase(started: try placement(.done)), .done(forToday: false))
    XCTAssertEqual(PlacementStep.Phase(started: try placement(.unavailable)), .unavailable)
  }

  func testStartSaysItDidNotStartWhenItsReadFails() {
    XCTAssertEqual(PlacementStep.Phase(started: nil), .waiting(failure: .notStarted))
  }

  private static let itemID = "0195f2a8-6a4b-7c3d-8e9f-0a1b2c3d4e5f"

  private func placement(_ status: Components.Schemas.PlacementStatus) throws -> GoalPlacement {
    let next: Any =
      status == .asking
      ? [
        "context": NSNull(), "format": "multipleChoice", "image": NSNull(), "itemId": Self.itemID,
        "options": ["Yes", "No"], "question": "Is it?", "select": 1,
        "skillId": "0195f2a8-6a4b-7c3d-8e9f-0a1b2c3d4e60", "visual": NSNull(),
      ] : NSNull()

    let json: [String: Any] = [
      "answered": 0, "areas": [], "complete": false, "dayBudgetSpent": 0, "dayBudgetUsed": false,
      "knownSkillIds": [], "needsItems": [], "next": next, "phases": [], "started": false,
      "status": status.rawValue, "trueFalseLabels": "trueFalse",
    ]

    return try JSONDecoder().decode(
      GoalPlacement.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
