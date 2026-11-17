import SwiftUI
import Vision
import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingLabelLayoutTests: XCTestCase {
  func testNamesClearSolidDashedAndGuideLinesAtActualLargeFontSizes() {
    for width in [176.0, 260, 600] {
      for size in [DynamicTypeSize.large, .xxxLarge, .accessibility3] {
        let area = CGRect(x: 0, y: 0, width: width, height: 240)
        let cost = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: 240 * (1 - 2000.0 / 5625)),
          to: CGPoint(x: width, y: 240 * (1 - 3875.0 / 5625)))
        let revenue = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: 240), to: CGPoint(x: width, y: 0))
        let before = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: cost.from.y + 20),
          to: CGPoint(x: width, y: cost.to.y + 20))
        let guide = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: 112), to: CGPoint(x: width * 200 / 375, y: 112))
        let lines = [cost, revenue, before, guide]
        let style = TypeStyle.meta.weight(.semibold)
        let labels = zip(["Cost", "Revenue"], [cost, revenue]).map { text, line in
          LineCrossingLabelLayout.Label(
            segment: line,
            size: CGSize(
              width: ceil(style.width(of: text, dynamicTypeSize: size, legibility: nil)),
              height: ceil(style.uiFont(size, legibility: nil).lineHeight)))
        }
        let boxes = LineCrossingLabelLayout.place(labels, in: area, lines: lines, obstacles: [])
        XCTAssertEqual(boxes.count, 2)
        XCTAssertFalse(boxes[0].insetBy(dx: -3, dy: -3).intersects(boxes[1]))
        for box in boxes {
          XCTAssertTrue(area.contains(box), "\(width), \(size), \(box)")
          for line in lines {
            for sample in 0...1000 {
              let t = Double(sample) / 1000
              let point = CGPoint(
                x: line.from.x + (line.to.x - line.from.x) * t,
                y: line.from.y + (line.to.y - line.from.y) * t)
              XCTAssertFalse(box.insetBy(dx: -2.9, dy: -2.9).contains(point))
            }
          }
        }
      }
    }
  }

  func testNarrowLargeBreakEvenNamesClearEveryLineAndAxisTitle() async throws {
    let fields = LineCrossingFields(
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
    let window = try show(
      LineCrossingCanvas(
        context: ActivityCanvasContext(
          template: "lineCrossing", payload: .null, check: nil, phase: .answering,
          answer: nil, setAnswer: { _ in }), fields: fields
      )
      .activityPanel().padding(16).frame(width: 320)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background(.white).environment(ActivityWork()).zoonkStyles()
      .preferredColorScheme(.light).dynamicTypeSize(.accessibility3))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 667)
    try await Task.sleep(for: .milliseconds(800))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    let attachment = XCTAttachment(image: image)
    attachment.lifetime = .keepAlways
    add(attachment)
    let cg = try XCTUnwrap(image.cgImage)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: cg).perform([request])
    let words = (request.results ?? []).compactMap { observation -> (String, CGRect)? in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      let box = observation.boundingBox
      return (
        text,
        CGRect(
          x: box.minX * CGFloat(cg.width), y: (1 - box.maxY) * CGFloat(cg.height),
          width: box.width * CGFloat(cg.width), height: box.height * CGFloat(cg.height))
      )
    }
    var rgba = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
    let context = try XCTUnwrap(
      CGContext(
        data: &rgba, width: cg.width, height: cg.height, bitsPerComponent: 8,
        bytesPerRow: cg.width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    context.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
    for name in ["Cost", "Revenue"] {
      let box = try XCTUnwrap(words.first { $0.0 == name }?.1, "Rendered words: \(words)")
      var otherLinePixels = 0
      for y in max(0, Int(box.minY) - 6)..<min(cg.height, Int(box.maxY) + 6) {
        for x in max(0, Int(box.minX) - 6)..<min(cg.width, Int(box.maxX) + 6) {
          let index = (y * cg.width + x) * 4
          let r = Int(rgba[index])
          let g = Int(rgba[index + 1])
          let b = Int(rgba[index + 2])
          let purple = r > g + 35 && b > g + 35 && r > 70
          let teal = g > r + 25 && b > r + 15 && g > 65
          if name == "Cost" ? purple : teal { otherLinePixels += 1 }
        }
      }
      XCTAssertEqual(otherLinePixels, 0, "\(name) rectangle \(box) crosses another line")
      for (_, title) in words.filter({
        $0.0.contains("Dollars") || $0.0.contains("month") || $0.0.contains("Lamps")
      }) {
        XCTAssertFalse(box.insetBy(dx: -6, dy: -6).intersects(title))
      }
    }
  }
}
