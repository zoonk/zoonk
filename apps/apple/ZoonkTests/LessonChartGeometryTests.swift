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
    XCTAssertEqual(scale.x.ticks, [10, 12, 14, 16, 18, 20], "whole data keeps whole ticks")
    XCTAssertEqual(scale.y.domain, 25...40)
    XCTAssertEqual(scale.y.ticks, [25, 30, 35, 40])
  }

  func testPlotAxesKeepFractionalTicksOnlyForFractionalData() throws {
    let scale = LessonPlotScale(try plot(points: [(1, 0.5), (10, 1.5)]))

    XCTAssertEqual(scale.x.ticks, [2, 4, 6, 8, 10])
    XCTAssertEqual(scale.y.ticks, [0.5, 0.75, 1, 1.25, 1.5])
  }

  func testAFlatLineSitsInTheMiddle() {
    XCTAssertEqual(ChartsMath.niceDomain([5, 5], includesZero: false), 4...6)
    XCTAssertEqual(ChartsMath.niceDomain([0.5], includesZero: false), 0.4...0.6)
    XCTAssertEqual(ChartsMath.niceDomain([0, 0]), 0...1)
    XCTAssertEqual(ChartsMath.niceDomain([]), 0...1)
  }

  func testPlotXSpansMonthsWithRoundTicksInside() throws {
    let months = LessonPlotScale(try plot(points: [1, 4, 8, 12].map { ($0, $0) }))

    XCTAssertEqual(months.x.domain, 1...12)
    XCTAssertEqual(months.x.ticks, [2, 4, 6, 8, 10, 12])
  }

  func testASinglePointSitsInTheMiddleOfBothAxes() throws {
    let single = LessonPlotScale(try plot(points: [(3, 952.5)]))

    XCTAssertEqual(single.x.domain, 2...4)
    XCTAssertEqual(
      single.y.domain.lowerBound + single.y.domain.upperBound, 952.5 * 2, accuracy: 1e-9)
  }

  func testTicksPrintAsManyDecimalsAsTheirStepNeeds() {
    let english = Locale(identifier: "en_US")

    XCTAssertEqual(
      LessonPlotTicks.format([1000, 1000.5, 1001], locale: english), ["1,000", "1,000.5", "1,001"])
    XCTAssertEqual(LessonPlotTicks.format([0, 0.25, 0.5], locale: english), ["0", "0.25", "0.5"])
    XCTAssertEqual(LessonPlotTicks.format([0, 0.1, 0.2], locale: english), ["0", "0.1", "0.2"])
  }

  func testLargeTicksShortenOnlyWhenEveryShortenedTickStaysExact() {
    let english = Locale(identifier: "en_US")

    XCTAssertEqual(
      LessonPlotTicks.format([10_000, 10_100, 10_200], locale: english), ["10K", "10.1K", "10.2K"])
    XCTAssertEqual(
      LessonPlotTicks.format([10_000, 10_025, 10_050], locale: english),
      ["10,000", "10,025", "10,050"])
  }

  func testAChartNamesItsUnitOnceBesideTheValueLabelAndKeepsACurrencyOnEachNumber() {
    let place = LessonChartUnit.place

    XCTAssertEqual(
      place("km", "Distance"), LessonChartUnit(currency: nil, valueLabel: "Distance (km)"))
    XCTAssertEqual(
      place("hours per 1,000 letters", "Sorting time"),
      LessonChartUnit(currency: nil, valueLabel: "Sorting time (hours per 1,000 letters)"))
    XCTAssertEqual(place("R$", "Price"), LessonChartUnit(currency: "BRL", valueLabel: "Price"))
    XCTAssertEqual(
      place("R$ per hour", "Pay"), LessonChartUnit(currency: "BRL", valueLabel: "Pay (per hour)"))
    XCTAssertEqual(place(nil, "Letters"), LessonChartUnit(currency: nil, valueLabel: "Letters"))
  }

  func testMoneyTicksKeepTheirCurrency() {
    XCTAssertEqual(
      LessonPlotTicks.format([0, 5, 10], unit: "BRL", locale: Locale(identifier: "en_US")),
      ["R$0", "R$5", "R$10"])
  }

  func testYearsOnTheXAxisHaveNoThousandsSeparator() {
    XCTAssertEqual(
      LessonPlotTicks.format([1960, 1980], xAxis: true, locale: Locale(identifier: "en_US")),
      ["1960", "1980"])
    XCTAssertEqual(
      LessonPlotTicks.format([950, 1000], locale: Locale(identifier: "pt_BR")), ["950", "1.000"])
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
