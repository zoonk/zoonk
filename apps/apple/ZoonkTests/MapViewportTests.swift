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
  func testNamedStreetStaysBesideItsOwnPathAtNormalAndTwiceTheTextSize() throws {
    for width in [100.0, 200.0] {
      let broad = MapViewport.Label(
        center: CGPoint(x: 160, y: 120),
        size: CGSize(width: width, height: width * 0.12), angle: 0, street: true,
        priority: true, positions: [CGPoint(x: 20, y: 120), CGPoint(x: 300, y: 120)])
      let oxford = MapViewport.Label(
        center: CGPoint(x: 160, y: 83), size: broad.size,
        angle: 0, street: true, priority: false,
        positions: [CGPoint(x: 20, y: 83), CGPoint(x: 300, y: 83)])
      let spot = try XCTUnwrap(
        MapViewport.placeLabels(
          [broad, oxford],
          pins: [CGPoint(x: 160, y: 120)], frame: CGSize(width: 320, height: 240))[0])
      XCTAssertLessThanOrEqual(abs(spot.y - 120), 40)
      XCTAssertLessThan(abs(spot.y - 120), abs(spot.y - 83))
      XCTAssertTrue(
        abs(spot.x - 160) >= width * spot.scale / 2 + 20
          || abs(spot.y - 120) >= broad.size.height * spot.scale / 2 + 20)
    }
  }
  func testNarrowAndWidenedStreetFramesKeepPinNumbersClear() throws {
    for width in [192.0, 320.0] {
      let center = CGPoint(x: width / 2, y: 90)
      let labels = [90.0, 25.0, 155.0].enumerated().map { index, y in
        MapViewport.Label(
          center: CGPoint(x: center.x, y: y), size: CGSize(width: 120, height: 24),
          angle: 0, street: true, priority: index == 0,
          positions: [CGPoint(x: 0, y: y), CGPoint(x: width, y: y)])
      }
      let spot = try XCTUnwrap(
        MapViewport.placeLabels(
          labels, pins: [center],
          frame: CGSize(width: width, height: 180),
          pinNumbers: [CGRect(x: center.x - 8, y: 80, width: 16, height: 20)])[0])
      XCTAssertLessThanOrEqual(abs(spot.y - 90), 40)
      XCTAssertLessThan(abs(spot.y - 90), min(abs(spot.y - 25), abs(spot.y - 155)))
      XCTAssertTrue(
        abs(spot.x - center.x) >= 60 * spot.scale + 8 || abs(spot.y - 90) >= 12 * spot.scale + 10)
      XCTAssertEqual(spot.overPinCircle, width == 192)
      if width == 192 { XCTAssertEqual(spot.scale, 0.8) }
    }
  }
  func testNamedLabelBoxClearsEveryPinBox() throws {
    let pins = [CGPoint(x: 160, y: 120), CGPoint(x: 190, y: 155)]
    let label = MapViewport.Label(
      center: named.center, size: named.size, angle: 0, street: true, priority: true,
      positions: [CGPoint(x: 150, y: 120), CGPoint(x: 170, y: 120)])
    let spot = try XCTUnwrap(
      MapViewport.placeLabels([label], pins: pins, frame: CGSize(width: 320, height: 240))[0])
    for pin in pins { XCTAssertTrue(abs(spot.x - pin.x) >= 60 || abs(spot.y - pin.y) >= 26) }
  }
  func testThreeNamedRegionsPackWithoutBoxOverlap() throws {
    let label = MapViewport.Label(
      center: CGPoint(x: 100, y: 20), size: CGSize(width: 110, height: 12), angle: 0, street: false,
      priority: true)
    let spots = MapViewport.placeLabels(
      [label, label, label], pins: [], frame: CGSize(width: 200, height: 40))
    XCTAssertTrue(spots.allSatisfy { $0 != nil })
    for i in spots.indices {
      for j in (i + 1)..<spots.count {
        let a = try XCTUnwrap(spots[i])
        let b = try XCTUnwrap(spots[j])
        XCTAssertTrue(
          abs(a.x - b.x) >= 55 * (a.scale + b.scale) || abs(a.y - b.y) >= 6 * (a.scale + b.scale))
      }
    }
  }
  func testQuestionNamesOutrankAnswerOnlyNamesAtMinimumSize() throws {
    let choice = MapViewport.Label(
      center: CGPoint(x: 50, y: 10), size: CGSize(width: 110, height: 12), angle: 0, street: false,
      priority: true)
    var question = choice
    question.question = true
    let spots = MapViewport.placeLabels(
      [choice, question], pins: [], frame: CGSize(width: 100, height: 20))
    XCTAssertNil(spots[0])
    let kept = try XCTUnwrap(spots[1])
    XCTAssertGreaterThanOrEqual(kept.scale, 0.8)
  }
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
      MapViewport.placeLabels(labels, pins: [], frame: CGSize(width: 210, height: 200)).map {
        $0?.center
      },
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
