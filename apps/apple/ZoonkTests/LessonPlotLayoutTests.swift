import XCTest

@testable import Zoonk

/// Main's `plot-layout.test.ts`, so a plot places its names as web and Android do.
final class LessonPlotLayoutTests: XCTestCase {
  /// How wide the plot draws inside its card on a 390-point phone.
  private let phone = 324.0
  private let textWidth = { (text: String) in Double(text.count) * 6.5 }

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

  func testReferenceNamesSitPastThePlotStackedApartAndAboveTheXAxisNumbers() throws {
    let control = layout(try controlPlot())
    let tops = control.references.map(\.top)

    XCTAssertLessThanOrEqual(
      control.plotRight + LessonPlotLayout.labelGap + textWidth("Upper limit"), phone)
    XCTAssertEqual(tops.count, 3)
    XCTAssertGreaterThanOrEqual(tops[1] - tops[0], 14)
    XCTAssertGreaterThanOrEqual(tops[2] - tops[1], 14)

    let close = layout(try controlPlot(references: [("Alarm", 497.1), ("Lower limit", 497)]))
    XCTAssertGreaterThanOrEqual(close.references[1].top - close.references[0].top, 14)
    XCTAssertLessThanOrEqual(close.references[1].top + 14, close.plotBottom)

    let narrow = layout(try controlPlot(), width: 127)
    let last = try XCTUnwrap(narrow.references.last)
    XCTAssertGreaterThan(last.lines.count, 1)
    XCTAssertLessThanOrEqual(last.top + Double(last.lines.count) * 14, narrow.plotBottom)
  }

  func testANarrowGutterNeverBreaksAReferenceNameInsideAWord() throws {
    let narrow = layout(try controlPlot(), width: 100)
    let words = Set(["Upper", "limit", "Target", "Lower"])

    for line in narrow.references.flatMap(\.lines) {
      XCTAssertTrue(line.split(separator: " ").allSatisfy { words.contains(String($0)) }, line)
    }
  }

  func testAPlotWithoutReferencesUsesTheFullWidth() throws {
    let scan = layout(try plot(series: [series("points", (1, 2, nil), (3, 4, nil))]))
    XCTAssertEqual(scan.plotRight, phone - LessonPlotLayout.right)
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
      plot, width: width ?? phone, textWidth: textWidth, locale: Locale(identifier: "en_US"))
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
