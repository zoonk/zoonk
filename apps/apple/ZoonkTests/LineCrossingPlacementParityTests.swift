import SwiftUI
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
        let before = try await nameFrames(
          fields, answer: answer, checked: false, width: width, size: size)
        let after = try await nameFrames(
          fields, answer: answer, checked: true, width: width, size: size)
        for line in fields.lines {
          let a = try XCTUnwrap(before[line.id])
          let b = try XCTUnwrap(after[line.id])
          XCTAssertEqual(a.midX, b.midX, accuracy: 1.0 / 3, "\(line.label), \(width), \(size)")
          XCTAssertEqual(a.midY, b.midY, accuracy: 1.0 / 3, "\(line.label), \(width), \(size)")
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

  func testChartNamesAreNearestTheirOwnNamedLineAtNarrowPlotSizes() {
    var failures: [String] = []
    for width in [176.0, 204, 320] {
      for height in [156.0, 204, 240] {
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
        let labels = zip(own, [45.0, 74]).map {
          LineCrossingLabelLayout.Label(segment: $0, size: CGSize(width: $1, height: 22))
        }
        let shown =
          labels + [
            .init(
              segment: before, size: CGSize(width: 55, height: 22), isUpper: false, isOptional: true
            )
          ]
        let boxes = LineCrossingLabelLayout.chart(
          shown: shown, revealed: [], in: CGRect(x: 0, y: 0, width: width, height: height),
          guides: guides, obstacles: [])
        for (index, box) in boxes.enumerated() {
          if index < own.count { XCTAssertNotNil(box, "\(width) × \(height), name \(index)") }
          guard let box else { continue }
          let ownLine = shown[index].segment
          let nearestOwn = distance(box, to: ownLine)
          for other in (own + [before]) where other != ownLine {
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

  func testMovedLineDoesNotSeparateBeforeFromItsLineAt390Points() throws {
    func line(_ x: CGFloat, _ y: CGFloat, _ endX: CGFloat, _ endY: CGFloat)
      -> LineCrossingLabelLayout.Segment
    {
      .init(from: .init(x: x, y: y), to: .init(x: endX, y: endY))
    }

    let supply = line(1, 218, 326, 134.8)
    let demand = line(1, 64.4, 301, 218)
    let original = line(1, 202.64, 326, 119.44)
    let answer = line(1, 187.28, 326, 104.08)
    let shown = [
      LineCrossingLabelLayout.Label(segment: supply, size: .init(width: 40, height: 16)),
      .init(segment: demand, size: .init(width: 49, height: 16)),
      .init(
        segment: original, size: .init(width: 38, height: 16), isUpper: false, isOptional: true),
    ]
    let area = CGRect(x: 1, y: 0, width: 325, height: 218)
    let guides = [
      line(1, 166.8, 201, 166.8), line(201, 166.8, 201, 218),
      line(1, 156.56, 181, 156.56), line(181, 156.56, 181, 218),
    ]
    let boxes = LineCrossingLabelLayout.chart(
      shown: shown,
      revealed: [.init(segment: answer, size: .init(width: 87, height: 16), isUpper: false)],
      in: area, guides: guides, obstacles: [.init(x: 1, y: 0, width: 105, height: 20)])
    let name = try XCTUnwrap(boxes[2])

    XCTAssertFalse(LineCrossingLabelLayout.touches(name.insetBy(dx: -3, dy: -3), answer))
    XCTAssertLessThan(name.midY, 218 - 83.2 * (name.midX - 1) / 325)
    XCTAssertLessThan(distance(name, to: original), distance(name, to: supply))
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

  func testAnswerKeepsClearAndUncrossedNamesStayPut() {
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
            XCTAssertEqual(beforeCheck.count, shown.count)
            XCTAssertEqual(afterCheck.count, shown.count + 1)
            XCTAssertNotNil(afterCheck.last ?? nil)
            for box in afterCheck.compactMap({ $0 }) {
              XCTAssertFalse(LineCrossingLabelLayout.touches(box, answer.segment))
            }
            for (index, pair) in zip(beforeCheck, afterCheck).enumerated() {
              let (before, after) = pair
              guard let before else {
                XCTAssertEqual(index, 2, "Only the optional before-line label may be hidden")
                XCTAssertNil(after)
                continue
              }
              let answerClears = !LineCrossingLabelLayout.touches(
                before.insetBy(dx: -3, dy: -3), answer.segment)
              if answerClears {
                XCTAssertEqual(
                  before, after, "\(width) × \(height), \(offset), \(labelHeight), \(index)")
              } else {
                XCTAssertNotNil(after)
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

  private func nameFrames(
    _ fields: LineCrossingFields, answer: ActivityAnswer, checked: Bool, width: Double,
    size: DynamicTypeSize
  ) async throws -> [String: CGRect] {
    var frames: [String: CGRect] = [:]
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
        .environment(\.lineCrossingNameFrame) { id, frame in frames[id] = frame }
        .preferredColorScheme(.light))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 667)
    defer { window.isHidden = true }
    try await waitForLayout(in: window)
    let expected = fields.lines.map(\.id) + (checked ? ["answer"] : [])
    try await waitForTestCondition(
      "Missing chart labels at \(width) pt, \(size), checked: \(checked). Frames: \(frames)"
    ) {
      expected.allSatisfy { id in
        guard let frame = frames[id], !frame.isEmpty else { return false }
        return window.bounds.contains(frame)
      }
    }
    if !checked { XCTAssertNil(frames["answer"]) }
    return frames
  }
}
