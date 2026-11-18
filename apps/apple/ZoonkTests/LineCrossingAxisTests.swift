import SwiftUI
import Vision
import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingAxisTests: XCTestCase {
  func testRenderedLampTicksMatchMain() async throws {
    let fields = lampFields
    let window = try show(
      LineCrossingCanvas(
        context: ActivityCanvasContext(
          template: "lineCrossing", payload: .null, check: nil, phase: .answering,
          answer: nil, setAnswer: { _ in }), fields: fields
      )
      .environment(ActivityWork())
      .padding(16)
      .frame(maxHeight: .infinity, alignment: .top)
      .background(.white)
      .preferredColorScheme(.light))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 600)
    try await Task.sleep(for: .milliseconds(600))

    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
    format.preferredRange = .standard
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    let attachment = XCTAttachment(image: image)
    attachment.lifetime = .keepAlways
    add(attachment)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: XCTUnwrap(image.cgImage)).perform([request])
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    let numbers = lines.filter { $0.range(of: #"^[0-9, .]+$"#, options: .regularExpression) != nil }
      .flatMap {
        $0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: ",", with: "")) }
      }
      // Vision can omit a single-character label; the value test covers both zero ticks.
      .filter { $0 != 0 }
      .sorted()
    XCTAssertEqual(numbers, [100, 200, 300, 2000, 4000], "Rendered text: \(lines)")
  }

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

  func testTicksUseFullLocalizedNumbersWithoutUnits() {
    for (locale, expected) in [("en_US", ["2,000", "0.25"]), ("pt_BR", ["2.000", "0,25"])] {
      XCTAssertEqual(
        [2000.0, 0.25].map { ActivityNumberFormat.format($0, locale: Locale(identifier: locale)) },
        expected)
    }
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
