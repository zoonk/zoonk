import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingAxisTests: XCTestCase {
  func testFixedLampDomainAndRoundTicksMatchMain() {
    let domain = LineCrossingModel.domain(lampFields)
    XCTAssertEqual(domain, .init(x: 375, y: 5625))
    XCTAssertEqual(ChartsAxis.ticks(0...domain.x), [0, 100, 200, 300])
    XCTAssertEqual(ChartsAxis.ticks(0...domain.y), [0, 2000, 4000])
    XCTAssertEqual(ChartsAxis.ticks(0...600), [0, 200, 400, 600])
    XCTAssertEqual(ChartsAxis.ticks(0...6000), [0, 2000, 4000, 6000])
    XCTAssertEqual(ChartsAxis.ticks(0...1), [0, 0.25, 0.5, 0.75, 1])

    let lines = lampFields.lines.map(LineCrossingModel.line)
    XCTAssertEqual(LineCrossingModel.crossing(lines[0], lines[1]).x, 200)
    XCTAssertEqual(
      LineCrossingModel.crossing(
        LineCrossingModel.moved(lines[0], by: 500, axis: .vertical), lines[1]
      ).x, 250)
  }

  private var lampFields: LineCrossingFields {
    LineCrossingFields(
      change: "The rent for the workshop goes up by $500 a month.",
      feedback: .init(
        wrongDirection: "Higher rent costs more at every quantity.",
        wrongLine: "The price of each lamp didn't change."),
      lines: [
        .init(id: "cost", label: "Cost", intercept: 2000, slope: 5),
        .init(id: "revenue", label: "Revenue", intercept: 0, slope: 15),
      ],
      shift: .init(amount: 500, direction: .up, line: "cost"),
      xLabel: "Lamps sold", yLabel: "Dollars per month")
  }
}
