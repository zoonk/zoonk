import SwiftUI
import Vision
import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingAxisTests: XCTestCase {
  func testRenderedLampTicksMatchMain() async throws {
    try requireIPhoneUI()
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
    let page = try XCTUnwrap(image.cgImage)
    let pageWords = try recognizedWords(in: page)
    // Read on the whole page, Vision can take the short monospaced ticks for upside-down text
    // ("00z" for 200), so each axis is read on its own: the values in the column left of the
    // plot, the ticks in the strip above the bottom axis's title.
    let title = try XCTUnwrap(
      pageWords.first { $0.text.hasPrefix("Lamps") }?.box, "Rendered text: \(pageWords)")
    let strip = try XCTUnwrap(
      page.cropping(
        to: CGRect(
          x: 0, y: title.minY - title.height * 3, width: CGFloat(page.width),
          height: title.height * 3
        ).integral))
    let values = pageWords.map(\.text).filter { $0.contains(",") }
    let ticks = try recognizedWords(in: strip).map(\.text)
    let numbers = (values + ticks)
      .filter { $0.range(of: #"^[0-9, .]+$"#, options: .regularExpression) != nil }
      .flatMap {
        $0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: ",", with: "")) }
      }
      // Vision can omit a single-character label; the value test covers both zero ticks.
      .filter { $0 != 0 }
      .sorted()
    XCTAssertEqual(numbers, [100, 200, 300, 2000, 4000], "Read values \(values), ticks \(ticks)")
  }

  /// Each line Vision reads, with its box in the image's pixels from the top left.
  private func recognizedWords(in image: CGImage) throws -> [(text: String, box: CGRect)] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: image).perform([request])
    let size = CGSize(width: image.width, height: image.height)
    return (request.results ?? []).compactMap { observation in
      observation.topCandidates(1).first.map { candidate in
        let box = observation.boundingBox
        return (
          candidate.string,
          CGRect(
            x: box.minX * size.width, y: (1 - box.maxY) * size.height,
            width: box.width * size.width,
            height: box.height * size.height)
        )
      }
    }
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
