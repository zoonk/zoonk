import SwiftUI
import XCTest

@testable import Zoonk

final class LessonPlotLayoutTests: XCTestCase {
  private let plotWidthOnAPhone = 324.0
  private let textWidth = { (text: String) in Double(text.count) * 6.6 }
  private var measure: LessonPlotLayout.Measure { .init(text: textWidth, name: textWidth) }

  func testPointsSpaceByTheirXValueAndKeepRepeatedX() throws {
    let line = layout(
      try plot(series: [series("line", (0, 0, nil), (1, 1, nil), (10, 10, nil))]))
    let points = line.series[0]
    XCTAssertEqual(points[2].x - points[1].x, (points[1].x - points[0].x) * 9, accuracy: 0.001)

    let repeated = layout(try plot(series: [series("points", (2, 60, nil), (2, 75, nil))]))
    XCTAssertEqual(repeated.series[0].count, 2)
    XCTAssertEqual(repeated.series[0][0].x, repeated.series[0][1].x)
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

  private func layout(_ plot: LessonPlot, width: Double? = nil) -> LessonPlotLayout {
    LessonPlotLayout(
      plot, width: width ?? plotWidthOnAPhone, measure: measure,
      locale: Locale(identifier: "en_US"))
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

  private func plot(
    series: [[String: Any]], references: [(String, Double)] = [], yUnit: String? = nil
  ) throws -> LessonPlot {
    let json: [String: Any] = [
      "title": "Title", "xLabel": "X", "xUnit": NSNull(), "yLabel": "Y",
      "yUnit": yUnit.map { $0 as Any } ?? NSNull(),
      "source": NSNull(), "series": series,
      "references": references.map { ["label": $0.0, "y": $0.1] },
    ]

    return try JSONDecoder().decode(
      LessonPlot.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
