import CoreGraphics
import XCTest

@testable import Zoonk

final class ChartTooltipPlacementTests: XCTestCase {
  private let bounds = CGRect(x: 0, y: 0, width: 350, height: 170)
  private let size = CGSize(width: 110, height: 52)

  func testSitsCenteredAboveItsPointWithAGap() {
    let origin = origin(anchor: CGRect(x: 160, y: 104, width: 20, height: 20))

    XCTAssertEqual(origin, CGPoint(x: 115, y: 44))
  }

  func testGoesBelowAPointTooCloseToTheTop() {
    let origin = origin(anchor: CGRect(x: 160, y: 16, width: 20, height: 20))

    XCTAssertEqual(origin, CGPoint(x: 115, y: 44))
  }

  func testNeverCrossesTheChartsSides() {
    XCTAssertEqual(origin(anchor: CGRect(x: 0, y: 104, width: 20, height: 20)).x, 0)
    XCTAssertEqual(origin(anchor: CGRect(x: 330, y: 104, width: 20, height: 20)).x, 240)
  }

  func testGoesBesideAPointWithNoRoomAboveOrBelow() {
    let tall = CGSize(width: 110, height: 120)
    let middle = CGRect(x: 160, y: 60, width: 20, height: 20)
    let nearEnd = CGRect(x: 320, y: 60, width: 20, height: 20)

    XCTAssertEqual(
      ChartTooltipPlacement.origin(of: tall, anchor: middle, in: bounds, staysInside: true),
      CGPoint(x: 188, y: 10))
    XCTAssertEqual(
      ChartTooltipPlacement.origin(of: tall, anchor: nearEnd, in: bounds, staysInside: true),
      CGPoint(x: 202, y: 10))
  }

  func testRisesAboveAChartItNeedNotStayInside() {
    let column = CGRect(x: 300, y: 0, width: 50, height: 0)

    XCTAssertEqual(
      ChartTooltipPlacement.origin(of: size, anchor: column, in: bounds, staysInside: false),
      CGPoint(x: 240, y: -60))
  }

  private func origin(anchor: CGRect) -> CGPoint {
    ChartTooltipPlacement.origin(of: size, anchor: anchor, in: bounds, staysInside: true)
  }
}
