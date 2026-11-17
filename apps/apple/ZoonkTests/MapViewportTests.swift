import CoreGraphics
import XCTest

@testable import Zoonk

final class MapViewportTests: XCTestCase {
  func testTranslatedCourseMatchesSourceOrTranslatedName() {
    for references in ["Onde fica a América do Norte?", "Onde fica North America?"] {
      XCTAssertTrue(
        MapViewport.isNamed(
          references: references, source: "North America", text: "América do Norte"))
    }
    XCTAssertFalse(
      MapViewport.isNamed(
        references: "Onde fica a Europa?", source: "North America", text: "América do Norte"))
  }
  private let named = MapViewport.Label(
    center: CGPoint(x: 160, y: 120), size: CGSize(width: 80, height: 12), angle: 0, street: true,
    priority: true, positions: [CGPoint(x: 160, y: 120)])
  func testNamedStreetSurvivesItsOnlySpotBeingUnderAPin() {
    XCTAssertNotNil(
      MapViewport.placeLabels(
        [named], pins: [named.center], frame: CGSize(width: 320, height: 240))[0])
  }
  func testTwoNamedLabelsOnOneSegmentStayReadable() {
    let spots = MapViewport.placeLabels(
      [named, named], pins: [], frame: CGSize(width: 320, height: 240))
    XCTAssertTrue(spots.allSatisfy { $0 != nil })
    XCTAssertNotEqual(spots[0], spots[1])
  }
  func testNamedRegionSurvivesAPinAtItsSpot() {
    let region = MapViewport.Label(
      center: named.center, size: named.size, angle: 0, street: false, priority: true)
    XCTAssertNotNil(
      MapViewport.placeLabels(
        [region], pins: [named.center], frame: CGSize(width: 320, height: 240))[0])
  }

  func testNamedStreetMovesOffItsPinBeforeAnOptionalLabel() {
    let labels = [
      MapViewport.Label(
        center: CGPoint(x: 138, y: 100), size: CGSize(width: 80, height: 12), angle: 0,
        street: false, priority: false),
      MapViewport.Label(
        center: CGPoint(x: 70, y: 100), size: CGSize(width: 80, height: 12), angle: 0, street: true,
        priority: true, positions: [CGPoint(x: 70, y: 100), CGPoint(x: 138, y: 100)]),
    ]
    let spots = MapViewport.placeLabels(
      labels, pins: [CGPoint(x: 70, y: 100)], frame: CGSize(width: 210, height: 200))
    XCTAssertNotNil(spots[1])
    XCTAssertGreaterThan(spots[1]!.x, 130)
    XCTAssertNil(spots[0])
  }

  func testDroppedLabelFreesItsSpaceAndOneEdgeRuleKeepsWhatFits() {
    let labels = [
      MapViewport.Label(
        center: CGPoint(x: 100, y: 100), size: CGSize(width: 500, height: 12), angle: 0,
        street: false, priority: false),
      MapViewport.Label(
        center: CGPoint(x: 100, y: 100), size: CGSize(width: 40, height: 12), angle: 0,
        street: false, priority: false),
      MapViewport.Label(
        center: CGPoint(x: 12, y: 30), size: CGSize(width: 20, height: 12), angle: 0, street: false,
        priority: false),
    ]
    XCTAssertEqual(
      MapViewport.placeLabels(labels, pins: [], frame: CGSize(width: 210, height: 200)),
      [nil, CGPoint(x: 100, y: 100), CGPoint(x: 12, y: 30)])
  }

  func testStreetCanSlideFartherThanItsTextWidthIntoTheVisibleFrame() throws {
    let labels = [
      MapViewport.Label(
        center: CGPoint(x: 70, y: 300), size: CGSize(width: 80, height: 12), angle: 90,
        street: true, priority: false,
        positions: [CGPoint(x: 70, y: 50), CGPoint(x: 70, y: 124), CGPoint(x: 70, y: 300)])
    ]
    let spots = MapViewport.placeLabels(
      labels, pins: [CGPoint(x: 70, y: 190)], frame: CGSize(width: 210, height: 200))
    let spot = try XCTUnwrap(spots[0])
    XCTAssertLessThan(spot.y, 130)
  }

  func testHidesStreetWhenAvoidingItsPinWouldMoveItBeyondTheDrawnStreet() {
    let labels = [
      MapViewport.Label(
        center: CGPoint(x: 70, y: 100), size: CGSize(width: 80, height: 12), angle: 90,
        street: true, priority: false, positions: [CGPoint(x: 70, y: 50), CGPoint(x: 70, y: 120)])
    ]
    let spots = MapViewport.placeLabels(
      labels, pins: [CGPoint(x: 70, y: 100)], frame: CGSize(width: 210, height: 250))
    XCTAssertNil(spots[0])
  }

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
