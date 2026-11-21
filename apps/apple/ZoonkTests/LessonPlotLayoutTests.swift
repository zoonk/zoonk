import SwiftUI
import XCTest

@testable import Zoonk

final class LessonPlotLayoutTests: XCTestCase {
  private let plotWidthOnAPhone = 324.0
  private let smallPhoneCard = 296.0
  private let textWidth = { (text: String) in Double(text.count) * 6.6 }
  private var measure: LessonPlotLayout.Measure { .init(text: textWidth, name: textWidth) }

  private func labelWidth(_ text: String) -> Double { textWidth(text) + LessonPlotLayout.labelGap }

  func testPointsSpaceByTheirXValueAndKeepRepeatedX() throws {
    let line = layout(
      try plot(series: [series("line", (0, 0, nil), (1, 1, nil), (10, 10, nil))]))
    let points = line.series[0]
    XCTAssertEqual(points[2].x - points[1].x, (points[1].x - points[0].x) * 9, accuracy: 0.001)

    let repeated = layout(try plot(series: [series("points", (2, 60, nil), (2, 75, nil))]))
    XCTAssertEqual(repeated.series[0].count, 2)
    XCTAssertEqual(repeated.series[0][0].x, repeated.series[0][1].x)
  }

  func testEachNameSitsBesideItsDotInsideThePlotCoveringNoOtherDotOrName() throws {
    let scan = layout(
      try plot(series: [
        series(
          "points", (0.5, 810, "A"), (1.5, 880, "B"), (3, 985, "C"), (4.5, 890, "D"),
          (5.5, 820, "E"))
      ]))

    XCTAssertEqual(scan.key, [])
    XCTAssertEqual(scan.labels.map(\.text), ["A", "B", "C", "D", "E"])

    for (index, label) in scan.labels.enumerated() {
      let dot = scan.series[0][index]
      let box = self.box(label)

      XCTAssertLessThan(hypot(dot.x - label.x, dot.y - label.y), 20)
      XCTAssertGreaterThanOrEqual(box.left, scan.left)
      XCTAssertGreaterThanOrEqual(box.top, 0)
      XCTAssertLessThanOrEqual(box.bottom, scan.plotBottom)

      for (otherIndex, other) in scan.labels.enumerated() where otherIndex != index {
        XCTAssertFalse(touches(box, self.box(other)))
      }
      for other in scan.series[0] {
        XCTAssertFalse(
          touches(
            box,
            LessonPlotLayout.Box(
              left: other.x - 4, top: other.y - 4, right: other.x + 4, bottom: other.y + 4)))
      }
    }
  }

  func testCrowdedLongNamesMoveToANumberedKeyAndNoneIsDropped() throws {
    let names = ["North", "South", "East", "West", "Center", "Harbor", "Airport", "Hills"].map {
      "\($0) warehouse"
    }
    let points =
      names.enumerated().map { (5 + Double($0.offset) * 0.1, 150 + Double($0.offset), $0.element) }
      + [(0, 100, nil), (10, 200, nil)]
    let crowded = layout(try plot(series: [series("points", points)]))

    XCTAssertEqual(crowded.key.map(\.label), names)
    XCTAssertEqual(crowded.labels.map(\.text), names.indices.map { "\($0 + 1)" })
  }

  func testReferenceNamesSitPastThePlotsRightEdgeWithoutOverlapping() throws {
    let control = layout(try controlPlot())
    let references = control.references

    XCTAssertEqual(references.map(\.label), ["Upper limit", "Target", "Lower limit"])
    XCTAssertLessThanOrEqual(
      control.plotRight + LessonPlotLayout.labelGap + labelWidth("Upper limit"),
      plotWidthOnAPhone + LessonPlotLayout.labelGap)
    XCTAssertEqual(references[0].y, control.y(503))
    XCTAssertGreaterThanOrEqual(references[1].top - references[0].top, 14)
    XCTAssertGreaterThanOrEqual(references[2].top - references[1].top, 14)
  }

  func testTheNamesColumnIsAsWideAsItsWidestWrappedLine() throws {
    let fine = layout(try fineScan(), width: 300)

    XCTAssertEqual(fine.references[0].lines, ["Needed", "tonight"])
    XCTAssertEqual(
      fine.plotRight, 300 - LessonPlotLayout.referenceInset - labelWidth("tonight"), accuracy: 0.01)
  }

  func testLinesTooCloseToNameApartAreNumberedEachLevelWithItsLine() throws {
    let close = layout(
      try controlPlot(references: [
        ("Upper limit", 501), ("Upper warning limit", 500.6), ("Target", 500),
      ]))

    XCTAssertEqual(
      close.key,
      [
        .init(marker: "1", label: "Upper limit"), .init(marker: "2", label: "Upper warning limit"),
        .init(marker: "3", label: "Target"),
      ])
    for reference in close.references {
      XCTAssertEqual(reference.top + 7, reference.y, accuracy: 0.01)
    }
    XCTAssertGreaterThan(close.references[1].x, close.references[0].x)
    XCTAssertGreaterThan(close.references[1].x, close.references[2].x)
  }

  func testLinesWhoseNamesCantFitBesideTheNarrowestPlotAreNumbered() throws {
    let german = layout(try controlPlot(references: [("Temperaturgrenze", 502)]), width: 220)

    XCTAssertEqual(german.key, [.init(marker: "1", label: "Temperaturgrenze")])
    XCTAssertEqual(german.references[0].lines, ["1"])
    XCTAssertGreaterThanOrEqual(german.plotRight - german.left, LessonPlotLayout.minPlotWidth)
  }

  func testTheKeysNumbersContinueFromTheLinesToThePoints() throws {
    let sites = layout(
      try plot(
        series: [
          series(
            "points",
            ["North", "South", "East"].enumerated().map {
              (5 + Double($0.offset) * 0.05, 850 + Double($0.offset), "\($0.element) warehouse")
            })
        ],
        references: [("Temperaturgrenze", 900)]),
      width: 200)

    XCTAssertEqual(sites.key.map(\.marker), ["1", "2", "3", "4"])
    XCTAssertEqual(sites.labels.map(\.text), ["2", "3", "4"])
  }

  func testAPointOnThePlotsRightEdgeKeepsClearOfTheReferenceNames() throws {
    for width in [plotWidthOnAPhone, 200] {
      let control = layout(try controlPlot(), width: width)
      let last = try XCTUnwrap(control.series[0].last)

      XCTAssertEqual(last.x, control.plotRight)
      for reference in control.references {
        XCTAssertGreaterThan(
          reference.x - control.plotRight,
          LessonPlotLayout.dotRadius + LessonPlotLayout.labelGap / 2)
      }
    }
  }

  func testASinglePointSitsInTheMiddleOfThePlot() throws {
    let single = layout(try plot(series: [series("points", (3, 952, "Peak"))]))
    let dot = single.series[0][0]

    XCTAssertEqual(dot.x, (single.left + single.plotRight) / 2, accuracy: 0.01)
    XCTAssertEqual(dot.y, (LessonPlotLayout.top + single.plotBottom) / 2, accuracy: 0.01)
  }

  func testTheXAxisSpansFromTheFirstDayToTheLast() throws {
    let control = layout(try controlPlot())

    XCTAssertEqual(control.scale.x.domain, 1...10)
    XCTAssertEqual(control.series[0][0].x, control.left)
    XCTAssertEqual(control.xTicks.map(\.label), ["2", "4", "6", "8", "10"])
  }

  func testEveryXNumberSitsUnderItsValueAndOneThatWouldReachTheCornerIsLeftOut() throws {
    let thousands = layout(
      try plot(
        series: [series("line", [1000, 1500, 2000].map { ($0, 500, nil) })],
        references: [("Upper limit", 503), ("Target", 500), ("Lower limit", 497)]))
    let x = { (value: Double) in
      thousands.left
        + (value - 1000) / 1000 * (thousands.plotRight - thousands.left)
    }

    for tick in thousands.xTicks {
      XCTAssertEqual(tick.center, x(tick.value), accuracy: 0.001)
    }
    XCTAssertEqual(thousands.xTicks.map(\.value), [1200, 1400, 1600, 1800, 2000])
  }

  func testTicksThatDifferPrintAsDifferentNumbers() throws {
    let visitors = layout(
      try plot(series: [series("points", [10_000, 10_150, 10_400].map { ($0, $0, nil) })]))

    XCTAssertEqual(Set(visitors.yTicks.map(\.label)).count, visitors.yTicks.count)
    XCTAssertEqual(Set(visitors.xTicks.map(\.label)).count, visitors.xTicks.count)
  }

  func testNoGridlineRunsUnderAReferenceLine() throws {
    let control = layout(try controlPlot())
    let target = try XCTUnwrap(control.yTicks.first { $0.value == 500 })

    XCTAssertEqual(target.label, "500")
    XCTAssertFalse(target.line)
    XCTAssertEqual(control.yTicks.filter(\.line).count, control.yTicks.count - 1)
  }

  func testCrowdedXNumbersThinOutOnANarrowPhone() throws {
    let wide = layout(try controlPlot())
    let wideText = { (text: String) in Double(text.count) * 20 }
    let narrow = LessonPlotLayout(
      try controlPlot(), width: 254, measure: .init(text: wideText, name: wideText),
      locale: Locale(identifier: "en_US"))

    XCTAssertGreaterThan(wide.xTicks.count, narrow.xTicks.count)
  }

  func testTheDrawingsTextStopsGrowingWhereThePlotWouldPassItsFloor() throws {
    let fine = try fineScan()
    let scale = LessonPlotLayout.scale(
      fine, text: 2, width: smallPhoneCard, measure: measure, locale: Locale(identifier: "en_US"))
    let capped = layout(fine, width: smallPhoneCard / scale)

    XCTAssertGreaterThan(scale, 1)
    XCTAssertLessThan(scale, 2)
    XCTAssertGreaterThanOrEqual(
      capped.plotRight - capped.left, LessonPlotLayout.minPlotWidth - 0.01)
    XCTAssertEqual(capped.key, [])
    XCTAssertEqual(capped.references[0].lines, ["Needed", "tonight"])
  }

  func testTheDrawingsTextFollowsTheReadersSizeWhereThePlotKeepsItsRoomAndNeverShrinks() throws {
    let fine = try fineScan()
    let english = Locale(identifier: "en_US")

    XCTAssertEqual(
      LessonPlotLayout.scale(fine, text: 2, width: 640, measure: measure, locale: english), 2)
    XCTAssertEqual(
      LessonPlotLayout.scale(fine, text: 1, width: 100, measure: measure, locale: english), 1)
  }

  func testAPlotWithoutReferencesUsesTheFullWidth() throws {
    let scan = layout(try plot(series: [series("points", (1, 2, nil), (3, 4, nil))]))
    XCTAssertEqual(scan.plotRight, plotWidthOnAPhone - LessonPlotLayout.right)
  }

  func testDotsShowOnEveryDottedPointAndOnlyALinesLastBesideOtherSeries() {
    let dot = LessonPlotLayout.drawsDot
    XCTAssertTrue(dot(0, .points, 3, 1))
    XCTAssertTrue(dot(0, .lineWithPoints, 3, 1))
    XCTAssertFalse(dot(2, .line, 3, 1))
    XCTAssertTrue(dot(2, .line, 3, 2))
    XCTAssertFalse(dot(1, .line, 3, 2))
  }

  private func layout(_ plot: LessonPlot, width: Double? = nil) -> LessonPlotLayout {
    LessonPlotLayout(
      plot, width: width ?? plotWidthOnAPhone, measure: measure,
      locale: Locale(identifier: "en_US"))
  }

  private func box(_ label: LessonPlotLayout.Label) -> LessonPlotLayout.Box {
    let width = textWidth(label.text)
    let left =
      switch label.anchor {
      case .start: label.x
      case .middle: label.x - width / 2
      case .end: label.x - width
      }

    return LessonPlotLayout.Box(
      left: left, top: label.y - 7, right: left + width, bottom: label.y + 7)
  }

  private func touches(_ a: LessonPlotLayout.Box, _ b: LessonPlotLayout.Box) -> Bool {
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  }

  private func series(_ mark: String, _ points: (Double, Double, String?)...) -> [String: Any] {
    series(mark, points)
  }

  private func series(_ mark: String, _ points: [(Double, Double, String?)]) -> [String: Any] {
    [
      "name": "Series", "mark": mark,
      "points": points.map { ["x": $0.0, "y": $0.1, "label": $0.2 ?? NSNull()] as [String: Any] },
    ]
  }

  private func fineScan() throws -> LessonPlot {
    let points: [(Double, Double, String?)] = [
      (1.5, 880, nil), (2, 930, nil), (2.25, 968, nil), (2.5, 992, nil), (2.75, 975, nil),
      (3, 952, nil), (3.25, 925, nil), (3.5, 905, nil), (4, 893, nil), (4.5, 890, nil),
    ]

    return try plot(
      series: [series("lineWithPoints", points)], references: [("Needed tonight", 960)])
  }

  private func controlPlot(references: [(String, Double)]? = nil) throws -> LessonPlot {
    let weights = [499.8, 500.6, 499.3, 501, 500.4, 501.6, 502.3, 503.8, 502.9, 502.1]

    return try plot(
      series: [
        series(
          "lineWithPoints", weights.enumerated().map { (Double($0.offset + 1), $0.element, nil) })
      ],
      references: references ?? [("Upper limit", 503), ("Target", 500), ("Lower limit", 497)])
  }

  private func plot(series: [[String: Any]], references: [(String, Double)] = []) throws
    -> LessonPlot
  {
    let json: [String: Any] = [
      "title": "Title", "xLabel": "X", "xUnit": NSNull(), "yLabel": "Y", "yUnit": NSNull(),
      "source": NSNull(), "series": series,
      "references": references.map { ["label": $0.0, "y": $0.1] },
    ]

    return try JSONDecoder().decode(
      LessonPlot.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
