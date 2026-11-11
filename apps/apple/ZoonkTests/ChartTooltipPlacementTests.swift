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
      ChartTooltipPlacement.origin(of: tall, anchor: middle, in: bounds),
      CGPoint(x: 188, y: 10))
    XCTAssertEqual(
      ChartTooltipPlacement.origin(of: tall, anchor: nearEnd, in: bounds),
      CGPoint(x: 202, y: 10))
  }

  func testStaysInSightWhereNothingFitsBesideAPoint() {
    let origin = ChartTooltipPlacement.origin(
      of: CGSize(width: 200, height: 60),
      anchor: CGRect(x: 150, y: -20, width: 50, height: 300),
      in: CGRect(x: 0, y: 0, width: 350, height: 200))

    XCTAssertEqual(origin, CGPoint(x: 75, y: 0))
  }

  func testFollowsAColumnScrolledUnderThePagesTop() throws {
    let chart = CGRect(x: 16, y: -100, width: 318, height: 200)
    let page = try XCTUnwrap(
      ChartTooltipPlacement.onPage(
        CGRect(x: 150, y: 0, width: 50, height: 200), chart: chart, pageHeight: 600))

    XCTAssertEqual(page.sight, CGRect(x: 16, y: 0, width: 318, height: 600))
    XCTAssertEqual(
      ChartTooltipPlacement.origin(
        of: CGSize(width: 200, height: 60), anchor: page.point,
        in: CGRect(origin: .zero, size: page.sight.size)),
      CGPoint(x: 75, y: 108))

    XCTAssertNil(
      ChartTooltipPlacement.onPage(
        CGRect(x: 150, y: 0, width: 50, height: 200), chart: chart.offsetBy(dx: 0, dy: -200),
        pageHeight: 600))
  }

  private func origin(anchor: CGRect) -> CGPoint {
    ChartTooltipPlacement.origin(of: size, anchor: anchor, in: bounds)
  }
}
