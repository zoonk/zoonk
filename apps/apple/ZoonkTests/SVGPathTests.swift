import SwiftUI
import XCTest

@testable import Zoonk

final class SVGPathTests: XCTestCase {
  func testRelativeAndShorthandCommandsFollowThePen() {
    let path = Path(svg: "M10 10 l5 0 h5 v5 l-10 0 z")
    XCTAssertEqual(path.boundingRect, CGRect(x: 10, y: 10, width: 10, height: 5))
  }

  func testPairsAfterAMoveAreLinesAndNumbersSplitOnASecondPoint() {
    XCTAssertEqual(
      Path(svg: "M0 0 10 0 10 10").boundingRect, CGRect(x: 0, y: 0, width: 10, height: 10))
    XCTAssertEqual(
      Path(svg: "M0 0 l3.6.8").boundingRect.size.width, 3.6, accuracy: 0.0001)
    XCTAssertEqual(
      Path(svg: "M0 0 l3.6.8").boundingRect.size.height, 0.8, accuracy: 0.0001)
  }

  func testAnArcTurnsTheWayItsSweepSays() {
    // From one end of a diameter to the other, clockwise on screen: over the top.
    let arc = Path(svg: "M0 0 A10 10 0 0 1 20 0").boundingRect
    XCTAssertEqual(arc.minX, 0, accuracy: 0.01)
    XCTAssertEqual(arc.maxX, 20, accuracy: 0.01)
    XCTAssertEqual(arc.minY, -10, accuracy: 0.05)
    XCTAssertEqual(arc.maxY, 0, accuracy: 0.01)
  }
}
