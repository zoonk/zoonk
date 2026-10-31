import XCTest

@testable import Zoonk

final class PlanPhaseWhenTests: XCTestCase {
  private func phase(_ index: Int, state: String) throws -> PlanPhase {
    let json = """
      {"challengeLeftOut": false, "chapters": [], "checkpoint": null,
       "endDate": "2026-12-0\(index + 2)", "index": \(index), "kind": "learn", "lessonsDone": 0,
       "lessonsTotal": 4, "mocks": {"count": 0, "nextDate": null}, "name": "Phase \(index)",
       "startDate": "2026-12-0\(index + 1)", "state": "\(state)"}
      """
    return try JSONDecoder().decode(PlanPhase.self, from: Data(json.utf8))
  }

  func testTheCurrentPhaseSaysTodayAndEachLaterOneItsStart() throws {
    let phases = [
      try phase(0, state: "done"), try phase(1, state: "current"),
      try phase(2, state: "upcoming"), try phase(3, state: "upcoming"),
    ]

    XCTAssertEqual(
      PhaseWhen.of(phases), [nil, .today, .starts("2026-12-03"), .starts("2026-12-04")])
  }

  func testAPhaseSettledByPlacementBeforeTheCurrentOneSaysNothing() throws {
    let phases = [try phase(0, state: "done"), try phase(1, state: "current")]

    XCTAssertEqual(PhaseWhen.of(phases), [nil, .today])
  }

  func testWithoutACurrentPhaseNoPhaseSaysWhen() throws {
    let phases = [try phase(0, state: "upcoming"), try phase(1, state: "upcoming")]

    XCTAssertEqual(PhaseWhen.of(phases), [nil, nil])
  }
}
