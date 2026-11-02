import CoreGraphics
import XCTest

@testable import Zoonk

final class MapViewportTests: XCTestCase {
  private let map = CGSize(width: 1000, height: 800)

  func testWithoutPlacesTheWholeMapShows() {
    XCTAssertEqual(
      MapViewport.fit(map: map, maxZoom: 4, points: []), CGRect(origin: .zero, size: map))
  }

  func testCloseUpIsCenteredOnThePlacesAndStaysInsideTheMap() {
    let crop = MapViewport.fit(
      map: map, maxZoom: 4, points: [CGPoint(x: 900, y: 700), CGPoint(x: 980, y: 780)])

    XCTAssertGreaterThanOrEqual(crop.width, map.width / 4, "no closer than the map's zoom allows")
    XCTAssertLessThanOrEqual(crop.maxX, map.width)
    XCTAssertLessThanOrEqual(crop.maxY, map.height)
    XCTAssertTrue(crop.contains(CGPoint(x: 980, y: 780)))
  }

  func testATallSpreadIsWidenedToTheTallestShapeAllowed() {
    let crop = MapViewport.fit(
      map: map, maxAspect: 0.8, maxZoom: 8,
      points: [CGPoint(x: 500, y: 100), CGPoint(x: 500, y: 600)])

    XCTAssertEqual(crop.height / crop.width, 0.8, accuracy: 0.001)
  }

  func testPinsOnTheSameSpotArePushedApartToTheirSpacing() {
    let spread = MapViewport.spread(
      [CGPoint(x: 100, y: 100), CGPoint(x: 100, y: 100)], distance: 40,
      in: CGSize(width: 300, height: 300))
    let gap = hypot(spread[0].x - spread[1].x, spread[0].y - spread[1].y)

    XCTAssertGreaterThanOrEqual(gap, 39.9)
  }

  func testPinsStayInsideTheFrame() {
    let spread = MapViewport.spread(
      [CGPoint(x: 0, y: 0), CGPoint(x: 299, y: 299)], distance: 40,
      in: CGSize(width: 300, height: 300))

    for pin in spread {
      XCTAssertTrue((20...280).contains(pin.x) && (20...280).contains(pin.y), "\(pin)")
    }
  }
}
