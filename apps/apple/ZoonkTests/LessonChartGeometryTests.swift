import XCTest

@testable import Zoonk

final class LessonChartGeometryTests: XCTestCase {
  /// Seven points a character, so a test reads widths off the names.
  private let width = { (text: String) in Double(text.count) * 7 }

  func testNamesBreakAfterSpacesAndHyphens() {
    XCTAssertEqual(
      LessonChartNames.pieces("Centro-Oeste do país"), ["Centro-", "Oeste ", "do ", "país"])
    XCTAssertEqual(LessonChartNames.pieces("Sul"), ["Sul"])
  }

  func testLineCountWrapsGreedilyAndRefusesAWordWiderThanTheBand() {
    XCTAssertEqual(LessonChartNames.lineCount("Centro-Oeste", room: 84, width: width), 1)
    XCTAssertEqual(LessonChartNames.lineCount("Centro-Oeste", room: 49, width: width), 2)
    XCTAssertNil(LessonChartNames.lineCount("Nordeste", room: 49, width: width))
    XCTAssertEqual(
      LessonChartNames.lineCount("Junho, durante a migração", room: 70, width: width), 3)
  }

  func testNamesStayUnderBarsOnlyWhenEachFitsInTwoLines() {
    let regions = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"]

    XCTAssertTrue(LessonChartNames.fitUnderBars(regions, band: 56, width: width))
    XCTAssertFalse(LessonChartNames.fitUnderBars(regions, band: 49, width: width))
    XCTAssertFalse(
      LessonChartNames.fitUnderBars(
        ["Maio, antes da mudança de sistema", "Junho"], band: 120, width: width))
    XCTAssertTrue(
      LessonChartNames.fitUnderBars(["Seg", "Ter", "Qua", "Qui", "Sex"], band: 21, width: width))
  }

  func testBarsLieSidewaysOnceTooManySeriesWouldThinThemToSlivers() {
    XCTAssertTrue(LessonChartBars.fitSideBySide(band: 70, series: 7))
    XCTAssertFalse(LessonChartBars.fitSideBySide(band: 70, series: 8))
  }

  func testTickNumbersThinUntilNoneTouch() {
    XCTAssertEqual(LessonChartTicks.labeled([(0, 10), (20, 30), (40, 50)]), [0, 1, 2])
    XCTAssertEqual(
      LessonChartTicks.labeled([(0, 30), (20, 50), (40, 70), (60, 90), (80, 110)]), [0, 2, 4])
    XCTAssertEqual(LessonChartTicks.labeled([(0, 60), (20, 80), (40, 100)]), [0])
    XCTAssertEqual(LessonChartTicks.labeled([]), [])
  }

  func testScaleStartsBarsAtZeroOrWhereACutAxisStarts() throws {
    let regions = LessonChartScale(try chart(values: [18, 42, 64, 30, 22]))
    XCTAssertEqual(regions.domain, 0...80)
    XCTAssertEqual(regions.ticks, [0, 20, 40, 60, 80])
    XCTAssertEqual(regions.origin, 0)

    let cut = LessonChartScale(try chart(values: [35, 36, 40], axisStart: 30))
    XCTAssertEqual(cut.domain, 30...40)
    XCTAssertEqual(cut.ticks, [30, 35, 40])
    XCTAssertEqual(cut.origin, 30)

    let negative = LessonChartScale(try chart(values: [-12, 8]))
    XCTAssertEqual(negative.domain, -15...10)
    XCTAssertEqual(negative.origin, 0)
  }

  func testALineChartStartsWhereItsAxisIsCutAndNeverForcesZero() throws {
    let cut = LessonChartScale(try chart(values: [9, 10, 11], axisStart: 9, style: "line"))
    XCTAssertEqual(cut.domain, 9...11)
    XCTAssertEqual(cut.ticks, [9, 10, 11])

    let far = LessonChartScale(try chart(values: [317, 414], style: "line"))
    XCTAssertEqual(far.domain, 300...425, "a line far from zero fits its values, as main's")
  }

  func testPlotAxesSpaceXByValueAndFitTheReferences() throws {
    let scale = LessonPlotScale(
      try plot(points: [(10, 27), (11, 25), (20, 30)], references: [40]))

    XCTAssertEqual(scale.x.domain, 10...20)
    XCTAssertEqual(scale.x.ticks, [10, 15, 20], "whole data keeps whole ticks")
    XCTAssertEqual(scale.y.domain, 25...40)
    XCTAssertEqual(scale.y.ticks, [25, 30, 35, 40])
  }

  func testPlotAxesKeepFractionalTicksOnlyForFractionalData() throws {
    let scale = LessonPlotScale(try plot(points: [(1, 0.5), (10, 1.5)]))

    XCTAssertEqual(scale.x.ticks, [0, 5, 10])
    XCTAssertEqual(scale.y.ticks, [0.5, 0.75, 1, 1.25, 1.5])
  }

  func testOneValueSpansFromItToOneMore() {
    XCTAssertEqual(ChartsMath.niceDomain([3], includesZero: false), 3...4)
    XCTAssertEqual(ChartsMath.niceDomain([]), 0...1)
  }

  private func plot(points: [(Double, Double)], references: [Double] = []) throws -> LessonPlot {
    let json: [String: Any] = [
      "title": "Title", "xLabel": "X", "xUnit": NSNull(), "yLabel": "Y", "yUnit": NSNull(),
      "source": NSNull(), "references": references.map { ["label": "Limit", "y": $0] },
      "series": [
        [
          "name": "Series", "mark": "points",
          "points": points.map { ["x": $0.0, "y": $0.1, "label": NSNull()] },
        ]
      ],
    ]

    return try JSONDecoder().decode(
      LessonPlot.self, from: JSONSerialization.data(withJSONObject: json))
  }

  private func chart(values: [Double], axisStart: Double? = nil, style: String = "bar") throws
    -> LessonChart
  {
    let json: [String: Any?] = [
      "chart": style, "title": "Title", "categoryLabel": "Group", "valueLabel": "Value",
      "unit": nil, "axisStart": axisStart, "source": nil,
      "categories": values.indices.map { "Category \($0)" },
      "series": [["name": "Series", "values": values]],
    ]

    return try JSONDecoder().decode(
      LessonChart.self,
      from: JSONSerialization.data(withJSONObject: json.mapValues { $0 ?? NSNull() }))
  }
}
