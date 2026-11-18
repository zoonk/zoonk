import SwiftUI
import Vision
import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingPlacementParityTests: XCTestCase {
  func testShownNamesKeepTheirRenderedPositionsAtCheck() async throws {
    let fields = LineCrossingFields(
      change: "Bird flu cut the number of laying hens.",
      feedback: .init(
        wrongDirection: "Fewer hens means less supply.", wrongLine: "People didn't want more eggs."),
      lines: [
        .init(id: "supply", label: "Supply", intercept: 1, slope: 0.5),
        .init(id: "demand", label: "Demand", intercept: 10, slope: -1),
      ], shift: .init(amount: 2, direction: .left, line: "supply"),
      xLabel: "Eggs sold", yLabel: "Price per dozen")
    let answer = try ActivityAnswer(encoding: LineShiftAnswer(curve: "supply", direction: .right))
    for width in [320.0, 375] {
      for size in [DynamicTypeSize.large, .accessibility3] {
        let before = try await names(
          fields, answer: answer, checked: false, width: width, size: size)
        let after = try await names(fields, answer: answer, checked: true, width: width, size: size)
        for name in ["Supply", "Demand"] {
          let a = try XCTUnwrap(before[name])
          let b = try XCTUnwrap(after[name])
          XCTAssertEqual(a.midX, b.midX, accuracy: 1.0 / 3, "\(name), \(width), \(size)")
          XCTAssertEqual(a.midY, b.midY, accuracy: 1.0 / 3, "\(name), \(width), \(size)")
        }
      }
    }
  }

  func testNamesAreNearestTheirOwnLineIncludingBeforeAndGuides() {
    var failures: [String] = []
    for width in [176.0, 204, 320] {
      for height in [360.0, 480, 600] {
        let cost = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: height * (1 - 2500.0 / 5625)),
          to: CGPoint(x: width, y: height * (1 - 4375.0 / 5625)))
        let revenue = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: height), to: CGPoint(x: width, y: 0))
        let before = LineCrossingLabelLayout.Segment(
          from: CGPoint(x: 0, y: height * (1 - 2000.0 / 5625)),
          to: CGPoint(x: width, y: height * (1 - 3875.0 / 5625)))
        let cross = CGPoint(x: width * 250 / 375, y: height * (1 - 3750.0 / 5625))
        let guides = [
          LineCrossingLabelLayout.Segment(from: CGPoint(x: 0, y: cross.y), to: cross),
          LineCrossingLabelLayout.Segment(from: CGPoint(x: cross.x, y: height), to: cross),
        ]
        let own = [cost, revenue]
        let all = own + [before] + guides
        let labels = zip(own, [45.0, 74]).map {
          LineCrossingLabelLayout.Label(segment: $0, size: CGSize(width: $1, height: 22))
        }
        let boxes = LineCrossingLabelLayout.place(
          labels, in: CGRect(x: 0, y: 0, width: width, height: height), lines: all, obstacles: []
        ).map { $0! }
        for (index, box) in boxes.enumerated() {
          let nearestOwn = distance(box, to: own[index])
          for other in all where other != own[index] {
            let otherDistance = distance(box, to: other)
            if nearestOwn > otherDistance + 0.1 {
              failures.append(
                "\(width)×\(height), name\(index): own \(nearestOwn), other \(otherDistance), box \(box)"
              )
            }
          }
        }
      }
    }
    XCTAssertTrue(failures.isEmpty, failures.first ?? "")
  }

  func testChartNameIsNearerItsLineThanTheGuide() throws {
    let own = LineCrossingLabelLayout.Segment(from: .init(x: 22, y: 104), to: .init(x: 311, y: 100))
    let guide = LineCrossingLabelLayout.Segment(from: .init(x: 22, y: 76), to: .init(x: 311, y: 76))
    let boxes = LineCrossingLabelLayout.chart(
      shown: [.init(segment: own, size: .init(width: 50, height: 12))],
      revealed: [], in: CGRect(x: 0, y: 0, width: 320, height: 220), guides: [guide], obstacles: [])
    let box = try XCTUnwrap(boxes[0])

    XCTAssertLessThan(distance(box, to: own), distance(box, to: guide))
  }

  func testCrossedNameMovesToTheNearestClearSpot() throws {
    let own = LineCrossingLabelLayout.Segment(from: .init(x: 22, y: 104), to: .init(x: 311, y: 100))
    let other = LineCrossingLabelLayout.Segment(
      from: .init(x: 22, y: 170), to: .init(x: 311, y: 160))
    let answer = LineCrossingLabelLayout.Segment(
      from: .init(x: 22, y: 86), to: .init(x: 311, y: 86))
    let size = CGSize(width: 50, height: 12)
    let area = CGRect(x: 0, y: 0, width: 320, height: 220)
    let shown = [own, other].map { LineCrossingLabelLayout.Label(segment: $0, size: size) }
    let before = LineCrossingLabelLayout.chart(
      shown: shown, revealed: [], in: area, guides: [], obstacles: [])
    let after = LineCrossingLabelLayout.chart(
      shown: shown, revealed: [.init(segment: answer, size: size, isUpper: false)],
      in: area, guides: [], obstacles: [])

    XCTAssertTrue(LineCrossingLabelLayout.touches(try XCTUnwrap(before[0]), answer))
    XCTAssertEqual(after[0], CGRect(x: 252, y: 104, width: 50, height: 12))
    XCTAssertEqual(after[1], before[1])
  }

  func testCrossedNameKeepsItsSideOfTheAnswerAt320PointsWithLargestText() throws {
    func segment(_ x: CGFloat, _ y: CGFloat, _ endX: CGFloat, _ endY: CGFloat)
      -> LineCrossingLabelLayout.Segment
    {
      .init(from: .init(x: x, y: y), to: .init(x: endX, y: endY))
    }

    let area = CGRect(x: 0, y: 0, width: 230, height: 248)
    let supply = segment(0, 248, 230, 141)
    let demand = segment(0, 50, 214, 248)
    let original = segment(0, 229, 230, 121)
    let answer = segment(0, 208, 230, 101)
    let guides = [segment(0, 182, 140, 182), segment(140, 182, 140, 248)]
    let shown = [
      LineCrossingLabelLayout.Label(segment: supply, size: .init(width: 55, height: 23)),
      .init(segment: demand, size: .init(width: 68, height: 23)),
      .init(
        segment: original, size: .init(width: 55, height: 23), isUpper: false, isOptional: true),
    ]
    let before = LineCrossingLabelLayout.chart(
      shown: shown, revealed: [], in: area, guides: guides, obstacles: [])
    let after = LineCrossingLabelLayout.chart(
      shown: shown,
      revealed: [.init(segment: answer, size: .init(width: 82, height: 46), isUpper: false)],
      in: area, guides: guides, obstacles: [])
    let box = try XCTUnwrap(after[2])

    XCTAssertTrue(LineCrossingLabelLayout.touches(try XCTUnwrap(before[2]), answer))
    XCTAssertEqual(before.prefix(2), after.prefix(2))
    XCTAssertGreaterThan(box.midY, 208 - 107 * box.midX / 230)
    XCTAssertGreaterThanOrEqual(distance(box, to: answer), 3)
    XCTAssertLessThan(distance(box, to: original), 40)
  }

  func testOnlyCrossedNamesMoveAcrossRevealMatrix() {
    for width in [176.0, 260, 320] {
      for height in [156.0, 240, 480] {
        for offset in [-40.0, -20, 20, 40] {
          for labelHeight in [14.0, 22, 28, 34] {
            let area = CGRect(x: 0, y: 0, width: width, height: height)
            let cost = LineCrossingLabelLayout.Segment(
              from: CGPoint(x: 0, y: height * 0.6 + offset),
              to: CGPoint(x: width, y: height * 0.3 + offset))
            let revenue = LineCrossingLabelLayout.Segment(
              from: CGPoint(x: 0, y: height), to: CGPoint(x: width, y: 0))
            let before = LineCrossingLabelLayout.Segment(
              from: CGPoint(x: 0, y: height * 0.6), to: CGPoint(x: width, y: height * 0.3))
            let shown = [cost, revenue, before].enumerated().map { index, segment in
              LineCrossingLabelLayout.Label(
                segment: segment, size: CGSize(width: 45, height: labelHeight),
                isUpper: index < 2, isOptional: index == 2)
            }
            let answer = LineCrossingLabelLayout.Label(
              segment: .init(
                from: CGPoint(x: 0, y: height * 0.6 - offset),
                to: CGPoint(x: width, y: height * 0.3 - offset)),
              size: CGSize(width: 90, height: labelHeight), isUpper: false)
            let beforeCheck = LineCrossingLabelLayout.chart(
              shown: shown, revealed: [], in: area, guides: [], obstacles: [])
            let afterCheck = LineCrossingLabelLayout.chart(
              shown: shown, revealed: [answer], in: area, guides: [], obstacles: [])
            for (before, after) in zip(beforeCheck, afterCheck) {
              if let before,
                LineCrossingLabelLayout.touches(
                  before.insetBy(dx: -3, dy: -3), answer.segment)
              {
                XCTAssertNotNil(after)
                if let after {
                  XCTAssertFalse(LineCrossingLabelLayout.touches(after, answer.segment))
                }
              } else {
                XCTAssertEqual(before, after)
              }
            }
          }
        }
      }
    }
  }

  private func distance(_ box: CGRect, to line: LineCrossingLabelLayout.Segment) -> Double {
    (0...2000).map { sample in
      let t = Double(sample) / 2000
      let x = line.from.x + (line.to.x - line.from.x) * t
      let y = line.from.y + (line.to.y - line.from.y) * t
      return hypot(max(box.minX - x, 0, x - box.maxX), max(box.minY - y, 0, y - box.maxY))
    }.min()!
  }

  private func inkBounds(image: CGImage, near rough: CGRect, name: String) throws -> CGRect {
    let scale = CGFloat(image.width) / 375
    let wordBounds = rough.applying(.init(scaleX: scale, y: scale))
    let region = wordBounds.insetBy(dx: -12 * scale, dy: -12 * scale)
      .intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height)).integral
    let left = Int(region.minX)
    let top = Int(region.minY)
    let width = Int(region.width)
    let height = Int(region.height)
    var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let context = try XCTUnwrap(
      CGContext(
        data: &pixels, width: image.width, height: image.height, bitsPerComponent: 8,
        bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    var mask = [Bool](repeating: false, count: width * height)
    for y in 0..<height {
      for x in 0..<width {
        let index = ((top + y) * image.width + left + x) * 4
        let r = Int(pixels[index])
        let g = Int(pixels[index + 1])
        let b = Int(pixels[index + 2])
        mask[y * width + x] =
          name == "Supply"
          ? g > r + 25 && b > r + 15 && g > 65
          : r > g + 35 && b > g + 35 && r > 70
      }
    }
    var ink = CGRect.null
    for start in mask.indices where mask[start] {
      var pending = [start]
      mask[start] = false
      var component = CGRect.null
      var touchesEdge = false
      while let point = pending.popLast() {
        let x = point % width
        let y = point / width
        component = component.union(CGRect(x: left + x, y: top + y, width: 1, height: 1))
        touchesEdge = touchesEdge || x == 0 || y == 0 || x == width - 1 || y == height - 1
        for dy in -1...1 {
          for dx in -1...1 {
            let nx = x + dx
            let ny = y + dy
            guard nx >= 0 && nx < width && ny >= 0 && ny < height else { continue }
            let next = ny * width + nx
            if mask[next] {
              mask[next] = false
              pending.append(next)
            }
          }
        }
      }
      // The padded crop can include detached chart ink outside the recognized word.
      if !touchesEdge && component.width > 1 && component.height > 1
        && wordBounds.intersects(component)
      {
        ink = ink.union(component)
      }
    }
    XCTAssertFalse(ink.isNull, "No rendered \(name) glyphs near \(rough)")
    return ink.applying(.init(scaleX: 1 / scale, y: 1 / scale))
  }

  private func names(
    _ fields: LineCrossingFields, answer: ActivityAnswer, checked: Bool, width: Double,
    size: DynamicTypeSize
  ) async throws -> [String: CGRect] {
    let window = try show(
      ScrollView {
        LineCrossingCanvas(
          context: ActivityCanvasContext(
            template: "lineCrossing", payload: .null,
            check: .interaction(explanation: "Here is why."),
            phase: checked ? .checked(isCorrect: false) : .answering,
            answer: answer, setAnswer: { _ in }), fields: fields
        )
        .activityPanel().padding(16)
      }.frame(width: width).frame(maxWidth: .infinity)
        .environment(ActivityWork()).zoonkStyles().dynamicTypeSize(size)
        .preferredColorScheme(.light))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 667)
    try await Task.sleep(for: .milliseconds(600))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
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
    window.isHidden = true
    var result: [String: CGRect] = [:]
    for word in request.results ?? [] {
      guard let recognized = word.topCandidates(1).first else { continue }
      let text = recognized.string.folding(
        options: .diacriticInsensitive, locale: Locale(identifier: "en_US"))
      for name in ["Supply", "Demand"] {
        guard result[name] == nil, text.contains(name) else { continue }
        let box = word.boundingBox
        let rough = CGRect(
          x: box.minX * 375, y: (1 - box.maxY) * 667,
          width: box.width * 375, height: box.height * 667)
        result[name] = try inkBounds(image: XCTUnwrap(image.cgImage), near: rough, name: name)

      }
    }
    return result
  }
}
