import XCTest

@testable import Zoonk

final class LessonVisualDecodingTests: XCTestCase {
  func testStepsWrittenBeforePlotsStillDecode() throws {
    XCTAssertEqual(try visual(chart)?.title, "Sales")
    XCTAssertEqual(try visual(timeline)?.title, "Moon landing")

    guard case .challenge(let content) = try step(challenge(nodeVisual: nil)).content else {
      return XCTFail("Expected a challenge")
    }

    XCTAssertNil(content.nodes.first?.visual, "a decision written before charts shows none")
  }

  func testAPlotDecodesEveryField() throws {
    guard case .plot(let plot) = try visual(plotJSON) else {
      return XCTFail("Expected a plot")
    }

    XCTAssertEqual(plot.xUnit, "s")
    XCTAssertNil(plot.yUnit)
    XCTAssertEqual(plot.series.first?.mark, .lineWithPoints)
    XCTAssertEqual(plot.series.first?.points.map(\.x), [1, 6])
    XCTAssertEqual(plot.series.first?.points.last?.label, "Peak")
    XCTAssertEqual(plot.references.first?.y, 12)
    XCTAssertNil(plot.source)
  }

  func testADecisionCarriesItsChartOrPlot() throws {
    for (json, title) in [(plotJSON, "Pressure over time"), (chart, "Sales")] {
      guard case .challenge(let content) = try step(challenge(nodeVisual: json)).content else {
        return XCTFail("Expected a challenge")
      }

      XCTAssertEqual(content.nodes.first?.visual?.title, title)
    }
  }

  func testAVisualOfAnUnknownKindDrawsNothingAndTheRestStillPlays() throws {
    let unknown = #"{"kind": "map", "title": "Somewhere", "regions": []}"#

    XCTAssertEqual(try visual(unknown), .unknown)

    guard case .challenge(let content) = try step(challenge(nodeVisual: unknown)).content else {
      return XCTFail("Expected a challenge")
    }

    XCTAssertEqual(content.nodes.first?.visual, .unknown)
    XCTAssertEqual(content.nodes.first?.prompt, "What now?")

    let set = try JSONDecoder().decode(
      PracticeItemSet.self,
      from: Data(
        #"""
        {"count": 2, "id": "set", "kind": "chart", "listening": null, "position": 1,
         "source": null, "text": null, "title": "Read the chart", "visual": \#(unknown)}
        """#.utf8))
    XCTAssertEqual(set.visual, .unknown, "a question's set still opens")
  }

  private func visual(_ json: String) throws -> LessonVisual? {
    try JSONDecoder().decode(LessonVisual.self, from: Data(json.utf8))
  }

  private func step(_ json: String) throws -> LessonStep {
    try JSONDecoder().decode(LessonStep.self, from: Data(json.utf8))
  }
}

private let chart = #"""
  {"kind": "chart", "chart": "line", "title": "Sales", "categoryLabel": "Month",
   "valueLabel": "Sales", "unit": null, "axisStart": 10, "categories": ["Jan", "Feb"],
   "series": [{"name": "Shop", "values": [12, 14]}], "source": null}
  """#

private let timeline = #"""
  {"kind": "timeline", "title": "Moon landing",
   "events": [{"date": "1969", "label": "Apollo 11", "detail": null}]}
  """#

private let plotJSON = #"""
  {"kind": "plot", "title": "Pressure over time", "xLabel": "Time", "xUnit": "s",
   "yLabel": "Pressure", "yUnit": null,
   "series": [{"name": "Line A", "mark": "lineWithPoints",
     "points": [{"x": 1, "y": 8, "label": null}, {"x": 6, "y": 11, "label": "Peak"}]}],
   "references": [{"label": "Limit", "y": 12}], "source": null}
  """#

private func challenge(nodeVisual: String?) -> String {
  let visual = nodeVisual.map { #""visual": \#($0), "# } ?? ""

  return #"""
    {"id": "challenge", "position": 0, "skillId": null, "citation": null, "image": null,
     "imagePending": false, "kind": "challenge", "content": {
       "title": "Launch", "variant": "work", "setting": "Office", "mission": "Ship", "team": [],
       "meters": [], "panels": [], "skills": [], "startNodeId": "n1",
       "nodes": [{"id": "n1", "prompt": "What now?", "messages": [], \#(visual)"choices": [
         {"id": "go", "text": "Ask", "next": "end", "quality": "strong", "effects": [],
          "replies": [], "notes": []}]}],
       "endings": [{"id": "end", "outcome": "Shipped."}]}}
    """#
}
