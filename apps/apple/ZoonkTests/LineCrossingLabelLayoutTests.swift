import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class LineCrossingLabelLayoutTests: XCTestCase {
  func testLargeNamesBelongToTheirOwnLineWhenStrokeClearanceIsTight() throws {
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
        let lines = [cost, revenue, before]
        let style = TypeStyle.meta.weight(.semibold)
        let labels = zip(["Cost", "Revenue"], [cost, revenue]).map { text, line in
          LineCrossingLabelLayout.Label(
            segment: line,
            size: CGSize(
              width: ceil(style.width(of: text, dynamicTypeSize: size, legibility: nil)),
              height: ceil(style.uiFont(size, legibility: nil).lineHeight)))
        }
        let boxes = try LineCrossingLabelLayout.place(
          labels, in: area, lines: lines, obstacles: [], guides: [guide]
        ).map { try XCTUnwrap($0) }
        XCTAssertEqual(boxes.count, 2)
        XCTAssertFalse(boxes[0].intersects(boxes[1]))
        for (box, label) in zip(boxes, labels) {
          XCTAssertTrue(area.contains(box), "\(width), \(size), \(box)")
          for other in lines where other != label.segment {
            XCTAssertFalse(
              LineCrossingLabelLayout.touches(box, other),
              "\(width), \(size), \(box) sits on a line it does not name")
          }
        }
      }
    }
  }
}
