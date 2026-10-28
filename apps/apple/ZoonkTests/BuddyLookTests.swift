import SwiftUI
import XCTest

@testable import Zoonk

final class BuddyLookTests: XCTestCase {
  func testTheBuddyGrowsWithTheBelts() {
    XCTAssertEqual(BuddyLook(belt: .white).stage, .baby)
    XCTAssertEqual(BuddyLook(belt: .yellow).stage, .baby)
    XCTAssertEqual(BuddyLook(belt: .orange).stage, .young)
    XCTAssertEqual(BuddyLook(belt: .green).stage, .young)
    XCTAssertEqual(BuddyLook(belt: .blue).stage, .adult)
    XCTAssertEqual(BuddyLook(belt: .black).stage, .adult)
  }

  func testEnergyWakesTheBuddyAndStudyKeepsItAwake() {
    XCTAssertEqual(BuddyLook(energy: nil).energyState, .awake)
    XCTAssertEqual(BuddyLook(energy: 29).energyState, .napping)
    XCTAssertEqual(BuddyLook(energy: 29, studiedToday: true).energyState, .awake)
    XCTAssertEqual(BuddyLook(energy: 30).energyState, .awake)
    XCTAssertEqual(BuddyLook(energy: 80).energyState, .glowing)
  }

  func testItsEverydayFaceFollowsItsEnergy() {
    XCTAssertEqual(BuddyLook(energy: 10).everydayExpression, .sleepy)
    XCTAssertEqual(BuddyLook(energy: 50).everydayExpression, .happy)
    XCTAssertEqual(BuddyLook(energy: 95).everydayExpression, .cheer)
  }

  func testTheGlowFollowsEnergyAndNeedsSome() {
    XCTAssertEqual(BuddyLook(energy: nil).glow, 0)
    XCTAssertEqual(BuddyLook(energy: 40).glow, 0.4, accuracy: 0.0001)
    XCTAssertEqual(BuddyLook(energy: 140).glow, 1)
  }

  func testAStageMilestoneDrawsTheBuddyGrownBeforeItsBeltIsReadAgain() {
    XCTAssertEqual(BuddyLook(belt: .yellow).grown(to: .young).belt, .orange)
    XCTAssertEqual(BuddyLook(belt: .green).grown(to: .adult).belt, .blue)
    XCTAssertEqual(BuddyLook(belt: .green).grown(to: .young).belt, .green)
    XCTAssertEqual(BuddyLook(belt: .red).grown(to: .young).belt, .red)
  }
}
