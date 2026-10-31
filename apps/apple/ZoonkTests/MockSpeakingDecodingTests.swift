import Foundation
import XCTest

@testable import Zoonk

final class MockSpeakingDecodingTests: XCTestCase {
  func testASpeakingPaperReadsItsPassRuleAndEstimate() throws {
    let rules: [(String, MockSpeaking.PassRule)] = [
      (#"{"kind":"group","min":30,"of":50}"#, .group(min: 30, of: 50)),
      (#"{"kind":"paper","min":12}"#, .paper(min: 12)),
      (#"{"kind":"floor","min":5}"#, .floor(min: 5)),
      (#"{"kind":"none"}"#, .none),
    ]

    for (json, expected) in rules {
      let paper = try decode(pass: json, estimate: estimate(complete: true, low: 18, high: 20))
      XCTAssertEqual(paper.pass, expected, json)
      XCTAssertEqual(paper.estimate.points?.low, 18)
      XCTAssertEqual(paper.estimate.points?.high, 20)
    }
  }

  func testAnIncompletePaperHasNoPoints() throws {
    let paper = try decode(
      pass: #"{"kind":"none"}"#, estimate: estimate(complete: false, low: 18, high: 20))

    XCTAssertNil(paper.estimate.points)
  }

  private func estimate(complete: Bool, low: Double, high: Double) -> String {
    #"{"complete":\#(complete),"high":\#(high),"low":\#(low),"total":25,"typed":false}"#
  }

  private func decode(pass: String, estimate: String) throws -> MockSpeaking {
    let json = #"""
      {"estimate":\#(estimate),"paper":"Prueba 4","pass":\#(pass),"tasks":[],"title":"DELE B2"}
      """#

    return try JSONDecoder().decode(MockSpeaking.self, from: Data(json.utf8))
  }
}
