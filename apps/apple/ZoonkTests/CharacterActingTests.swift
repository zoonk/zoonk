import SwiftUI
import XCTest

@testable import Zoonk

final class CharacterActingTests: XCTestCase {
  func testCurvesStartAtZeroAndLandAtOne() {
    for ease in [ActEase.accelerate, .follow, .out, .spring, .swing] {
      XCTAssertEqual(ease.value(at: 0), 0, accuracy: 0.001, "\(ease)")
      XCTAssertEqual(ease.value(at: 1), 1, accuracy: 0.001, "\(ease)")
    }
  }

  func testSpringsPassTheirStopAndCurvesKeepTheirShape() {
    XCTAssertEqual(ActEase.spring.value(at: 0.53), 1.046, accuracy: 0.001)
    XCTAssertEqual(ActEase.follow.value(at: 0.292), 1.205, accuracy: 0.001)
    XCTAssertGreaterThan(ActEase.out.value(at: 0.5), 0.85)
    XCTAssertLessThan(ActEase.accelerate.value(at: 0.5), 0.25)
    XCTAssertEqual(ActEase.swing.value(at: 0.5), 0.5, accuracy: 0.001)
  }

  func testAHeldKeyChangesOnlyWhenItsFrameComes() {
    XCTAssertEqual(ActEase.hold.value(at: 0.99), 0)
    XCTAssertEqual(ActEase.hold.value(at: 1), 1)
  }

  func testATrackStartsWhereThePartIsDrawnAndLandsOnTheExpressionsPose() {
    let crown = ActTrack(
      part: .crown, keys: [ActKey(at: 4, ease: .out, rotate: -14)], settle: .follow)
    let from = PartPose(rotate: -7)
    let to = PartPose(rotate: -18)

    XCTAssertEqual(crown.pose(at: 0, frames: 10, from: from, to: to).rotate, -7)
    XCTAssertEqual(crown.pose(at: 4, frames: 10, from: from, to: to).rotate, -14, accuracy: 0.001)
    XCTAssertEqual(crown.pose(at: 10, frames: 10, from: from, to: to).rotate, -18)
    XCTAssertLessThan(crown.pose(at: 6, frames: 10, from: from, to: to).rotate, -18)
  }

  func testAKeyAtTheFirstFrameReplacesTheStart() {
    let sweat = ActTrack(
      part: .sweat, keys: [ActKey(at: 0, translate: [0, -4]), ActKey(at: 8, translate: [0, 2])])

    XCTAssertEqual(sweat.pose(at: 0, frames: 8, from: .still, to: .still).translate, [0, -4])
    XCTAssertEqual(sweat.pose(at: 8, frames: 8, from: .still, to: .still).translate, [0, 2])
  }

  func testABlinksLidLineShowsOnlyWhileTheEyesAreShut() {
    let blink = BuddyAct.blink.act
    let lidAt = { (frame: Double) in
      blink.poses(at: frame, from: BuddyArt.poses(of: .happy), to: BuddyArt.poses(of: .happy))[
        .lidLeft]?.opacity
    }

    XCTAssertEqual(lidAt(0), 0)
    XCTAssertEqual(lidAt(2), 1)
    XCTAssertEqual(lidAt(4), 0)
    XCTAssertEqual(
      blink.poses(at: 2, from: [:], to: [:])[.eyeLeft]?.scale.y ?? 1, 0.1, accuracy: 0.001)
  }

  func testAnUntrackedPartKeepsThePoseItsDrawnIn() {
    let poses = TricksterAct.sly.act.poses(
      at: 6, from: TricksterExpression.defeated.poses, to: TricksterExpression.sly.poses)

    XCTAssertEqual(poses[.body], TricksterExpression.defeated.poses[.body])
    XCTAssertEqual(poses[.armLeft], TricksterExpression.defeated.poses[.armLeft])
    XCTAssertNil(poses[.sweat])
  }

  func testTheFaceSwapsAtItsFrame() {
    let cheer = BuddyAct.cheer.act

    XCTAssertEqual(cheer.face(at: -1, from: .happy), .happy)
    XCTAssertEqual(cheer.face(at: 3.9, from: .happy), .happy)
    XCTAssertEqual(cheer.face(at: 4, from: .happy), .cheer)
    XCTAssertEqual(BuddyAct.blink.act.face(at: 5, from: .kind), .kind)
  }

  func testEveryActKeepsItsKeysInOrderInsideItsFrames() {
    let acts =
      BuddyAct.allCases.map { ("\($0)", $0.act.frames, $0.act.tracks) }
      + TricksterAct.allCases.map { ("\($0)", $0.act.frames, $0.act.tracks) }

    for (name, frames, tracks) in acts {
      for track in tracks {
        let frameOrder = track.keys.map(\.at)
        XCTAssertEqual(frameOrder, frameOrder.sorted(), "\(name) \(track.part)")
        XCTAssertTrue(frameOrder.allSatisfy { $0 >= 0 && $0 <= frames }, "\(name) \(track.part)")
      }
    }
  }

  func testEverySwappingActSwapsIntoTheExpressionItLandsIn() {
    let buddySwaps = BuddyAct.allCases.map(\.act).filter { $0.swapAt != nil }
    let tricksterSwaps = TricksterAct.allCases.map(\.act).filter { $0.swapAt != nil }

    for act in buddySwaps {
      XCTAssertNotNil(act.to)
      XCTAssertTrue((0..<act.frames).contains(act.swapAt ?? -1))
    }
    for act in tricksterSwaps {
      XCTAssertNotNil(act.to)
      XCTAssertTrue((0..<act.frames).contains(act.swapAt ?? -1))
    }
  }
}
