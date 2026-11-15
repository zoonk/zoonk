import XCTest

@testable import Zoonk

final class JoinedFactsTests: XCTestCase {
  private let noBreak = "\u{00A0}"

  func testTheDotStaysWithTheFactBeforeIt() {
    XCTAssertEqual(
      ["Quantum physics from scratch", "Beginner"].joinedFacts(),
      "Quantum physics from scratch\(noBreak)· Beginner")
  }

  func testANumberKeepsItsNoun() {
    XCTAssertEqual(
      ["9 chapters", "23 short lessons"].joinedFacts(),
      "9\(noBreak)chapters\(noBreak)· 23\(noBreak)short\(noBreak)lessons")
    XCTAssertEqual(["~28 weeks"].joinedFacts(), "~28\(noBreak)weeks")
  }

  func testWordsStillWrap() {
    XCTAssertEqual(
      ["Chapter 3", "Waves and particles in everyday life"].joinedFacts(),
      "Chapter 3\(noBreak)· Waves and particles in everyday life")
  }

  func testEmptyAndOneFact() {
    XCTAssertEqual([String]().joinedFacts(), "")
    XCTAssertEqual(["Alone"].joinedFacts(), "Alone")
  }
}
