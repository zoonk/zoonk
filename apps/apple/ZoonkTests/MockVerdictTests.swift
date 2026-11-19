import XCTest

@testable import Zoonk

final class MockVerdictTests: XCTestCase {
  func testTheHighestScoreIsStrongestAndTheLowestIsTheOneToWorkOn() {
    let verdict = result([
      area("Languages", correct: 4, score: 480), area("English", correct: 8, score: 620),
      area("Humanities", correct: 6, score: 540),
    ]).verdictAreas

    XCTAssertEqual(verdict?.best.name, "English")
    XCTAssertEqual(verdict?.worst.name, "Languages")
  }

  func testSubjectsWithoutAScoreCompareByTheirShareOfRightAnswers() {
    let verdict = result([area("Law", correct: 3), area("Ethics", correct: 9)]).verdictAreas

    XCTAssertEqual(verdict?.best.name, "Ethics")
    XCTAssertEqual(verdict?.worst.name, "Law")
  }

  func testNoSubjectIsStrongestWhenNoAnswerWasRight() {
    let blank = result([
      area("Languages", correct: 0, score: 320), area("Humanities", correct: 0, score: 350),
    ])

    XCTAssertNil(blank.verdictAreas)
  }

  func testNoSubjectIsTheOneToWorkOnWhenEveryAnswerWasRight() {
    let perfect = result([
      area("Languages", correct: 10, score: 800), area("Humanities", correct: 10, score: 830),
    ])

    XCTAssertNil(perfect.verdictAreas)
  }

  func testOneSubjectOrSubjectsThatDidTheSameSayNothing() {
    XCTAssertNil(result([area("Law", correct: 5)]).verdictAreas)
    XCTAssertNil(result([area("Law", correct: 5), area("Ethics", correct: 5)]).verdictAreas)
    XCTAssertNil(result([]).verdictAreas)
  }

  private func area(_ name: String, correct: Double, score: Double? = nil) -> MockResult.Area {
    MockResult.Area(
      correct: correct, name: name,
      score: score.map { MockResult.Area.Score(high: $0 + 60, low: $0 - 60, score: $0) },
      secondsPerQuestion: 120, targetSecondsPerQuestion: nil, total: 10)
  }

  private func result(_ areas: [MockResult.Area]) -> MockResult {
    MockResult(
      areas: areas, blank: 0, calibration: nil, coherence: nil, correct: 0, irt: nil,
      minutesUsed: 0, net: nil, plannedMinutes: 0, points: nil, preparation: nil, previous: nil,
      topics: [], total: 60, unansweredAtTimeout: 0)
  }
}
