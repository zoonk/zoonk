import Foundation
import XCTest

@testable import Zoonk

final class MockPointsTests: XCTestCase {
  func testAResultReadsItsPointsAndAnExamWithoutThemReadsNone() throws {
    let scored = try decodeResult(points: fullMockJSON)
    let unscored = try decodeResult(points: "null")

    XCTAssertEqual(scored.points?.earned, 38)
    XCTAssertEqual(scored.points?.parts.map(\.name), ["P1", "P2"])
    XCTAssertEqual(scored.points?.unjudged.first?.minimum.unit, .points)
    XCTAssertNil(unscored.points)
  }

  func testAMissIsReadFirstAndTheTestsTogetherFollowWhenTheyHaveAMinimum() throws {
    let points = try decodePoints(fullMockJSON)

    XCTAssertEqual(points.tests.map(\.name), ["P2", "P1", nil])
  }

  func testTheTestsTogetherGetNoRowWithoutAMinimum() throws {
    let points = try decodePoints(halfMockJSON)

    XCTAssertEqual(points.tests.map(\.name), ["P1"])
  }

  func testEachTestSaysItsMinimumInWordsAndNumbers() throws {
    let tests = try decodePoints(fullMockJSON).tests

    XCTAssertEqual(tests[0].requirement, "2 points short of the 8 it needs")
    XCTAssertEqual(tests[0].score, "6 of 20")
    XCTAssertEqual(
      tests[1].requirement, "Reached the 50% it needs · Doesn't count toward the total")
    XCTAssertEqual(tests[2].requirement, "Reached the 30 points it needs")
  }

  func testAFullMockSaysWhichMissWouldEliminateTheLearner() throws {
    let verdict = try XCTUnwrap(decodePoints(fullMockJSON).verdict)

    XCTAssertFalse(verdict.met)
    XCTAssertEqual(verdict.text, "You'd be eliminated: P2 is 2 points short of 8.")
  }

  func testAFullMockThatMeetsEveryMinimumSaysSo() throws {
    let verdict = try XCTUnwrap(decodePoints(fullMock(p2Met: true)).verdict)

    XCTAssertTrue(verdict.met)
    XCTAssertEqual(verdict.text, "Meets the objective minimums checked here.")
  }

  func testAHalfMockProjectsWithoutAVerdict() throws {
    let points = try decodePoints(halfMockJSON)

    XCTAssertNil(points.verdict)
    XCTAssertEqual(points.tests[0].requirement, "Needs \(MockLabels.number(1.5)) points")
    XCTAssertEqual(points.tests[0].score, "\(MockLabels.number(12.5)) of 20")
    XCTAssertEqual(
      points.projection,
      "About 25 of 40 points on the whole exam, projected from this mock. Only a full mock says whether you'd reach the minimums."
    )
  }

  func testAMinimumTheMockCouldntCheckIsListedAsStillAhead() throws {
    let points = try decodePoints(fullMockJSON)

    XCTAssertEqual(
      points.unjudged.map(\.line),
      ["Discursiva needs 1 point and isn't in this mock."])
  }

  private var fullMockJSON: String { fullMock(p2Met: false) }

  private func fullMock(p2Met: Bool) -> String {
    #"""
    {"asked":60,"earned":38,"max":60,"met":true,"minimum":{"unit":"points","value":30},
     "projected":null,"short":null,
     "parts":[
       {"asked":40,"earned":32,"max":40,"met":true,"minimum":{"unit":"percent","value":50},
        "projected":null,"short":null,"name":"P1","qualifying":true},
       {"asked":20,"earned":6,"max":20,"met":\#(p2Met),"minimum":{"unit":"points","value":8},
        "projected":null,"short":\#(p2Met ? "null" : "2"),"name":"P2","qualifying":false}],
     "unjudged":[{"minimum":{"unit":"points","value":1},"name":"Discursiva"}]}
    """#
  }

  private let halfMockJSON = #"""
    {"asked":20,"earned":12.5,"max":40,"met":null,"minimum":null,"projected":25,"short":null,
     "parts":[
       {"asked":10,"earned":6.25,"max":20,"met":null,"minimum":{"unit":"points","value":1.5},
        "projected":12.5,"short":null,"name":"P1","qualifying":false}],
     "unjudged":[]}
    """#

  private func decodePoints(_ json: String) throws -> MockPoints {
    try JSONDecoder().decode(MockPoints.self, from: Data(json.utf8))
  }

  private func decodeResult(points: String) throws -> MockResult {
    let json = #"""
      {"areas":[],"blank":0,"calibration":null,"coherence":null,"correct":30,"irt":null,
       "minutesUsed":100,"net":null,"plannedMinutes":120,"points":\#(points),"preparation":null,
       "previous":null,"topics":[],"total":60,"unansweredAtTimeout":0}
      """#

    return try JSONDecoder().decode(MockResult.self, from: Data(json.utf8))
  }
}
