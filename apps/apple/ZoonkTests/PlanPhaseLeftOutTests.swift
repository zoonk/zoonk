import XCTest

@testable import Zoonk

final class PlanPhaseLeftOutTests: XCTestCase {
  private func phase(
    state: String, lessonsDone: Int = 0, lessonsTotal: Int = 0, challengeLeftOut: Bool = false
  ) throws -> PlanPhase {
    let json = """
      {"challengeLeftOut": \(challengeLeftOut), "chapters": [], "checkpoint": null,
       "endDate": "2026-12-01", "index": 0, "kind": "learn", "lessonsDone": \(lessonsDone),
       "lessonsTotal": \(lessonsTotal), "mocks": {"count": 0, "nextDate": null}, "name": "Basics",
       "startDate": "2026-11-01", "state": "\(state)"}
      """
    return try JSONDecoder().decode(PlanPhase.self, from: Data(json.utf8))
  }

  func testAPhaseWhoseChallengeHasNoRoomSaysSoWhateverItsState() throws {
    for state in ["current", "upcoming", "done"] {
      XCTAssertEqual(
        try phase(state: state, challengeLeftOut: true).leftOut, .noTimeForChallenge, state)
    }
  }

  func testAPhaseMovedPastKeepsWhatItLeftOut() throws {
    XCTAssertEqual(
      try phase(state: "unfinished", lessonsDone: 3, lessonsTotal: 5, challengeLeftOut: true)
        .leftOut,
      .lessons(2))
    XCTAssertEqual(
      try phase(state: "unfinished", lessonsDone: 5, lessonsTotal: 5, challengeLeftOut: true)
        .leftOut,
      .challenge)
    XCTAssertEqual(try phase(state: "leftOut", challengeLeftOut: true).leftOut, .notInPlan)
  }

  func testAPhaseWithItsChallengeSaysNothingLeftOut() throws {
    XCTAssertNil(try phase(state: "current").leftOut)
    XCTAssertNil(try phase(state: "upcoming").leftOut)
  }
}
