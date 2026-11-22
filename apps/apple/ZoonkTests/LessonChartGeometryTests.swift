import XCTest

@testable import Zoonk

final class LessonChartGeometryTests: XCTestCase {
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

  func testMoneyTicksKeepTheirCurrency() {
    XCTAssertEqual(
      LessonPlotTicks.format([0, 5, 10], unit: "BRL", locale: Locale(identifier: "en_US")),
      ["R$0", "R$5", "R$10"])
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
