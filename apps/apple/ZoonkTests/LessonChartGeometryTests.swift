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

  private func chart(values: [Double], axisStart: Double? = nil) throws -> LessonChart {
    let json: [String: Any?] = [
      "chart": "bar", "title": "Title", "categoryLabel": "Group", "valueLabel": "Value",
      "unit": nil, "axisStart": axisStart, "source": nil,
      "categories": values.indices.map { "Category \($0)" },
      "series": [["name": "Series", "values": values]],
    ]

    return try JSONDecoder().decode(
      LessonChart.self,
      from: JSONSerialization.data(withJSONObject: json.mapValues { $0 ?? NSNull() }))
  }
}
