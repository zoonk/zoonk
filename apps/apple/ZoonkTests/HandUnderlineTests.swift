import XCTest

@testable import Zoonk

final class HandUnderlineTests: XCTestCase {
  /// "for" ends a line and "the board" starts the next, as on a phone.
  func testAWrappedPhraseGetsItsSliceOfOneStrokeOnEachLine() {
    let unit: CGFloat = 0.5
    let whole = HandUnderline(widths: [150], unit: unit).slices[0].pen
    let wrapped = HandUnderline(widths: [22, 128], unit: unit).slices

    XCTAssertEqual(wrapped[0].pen.first?.x, 0)
    XCTAssertEqual(wrapped[0].pen.last?.x, 22, "nothing past the short word")
    XCTAssertEqual(wrapped[1].pen.last?.x, 128)

    for (start, slice) in zip([0, 22] as [CGFloat], wrapped) {
      for point in slice.pen {
        XCTAssertEqual(
          point.y, height(of: whole, at: start + point.x), accuracy: 0.02,
          "each line draws the same stroke the phrase would on one line, at \(start + point.x)")
      }
    }
  }

  func testOnlyThePhrasesRealEndCurls() {
    let lifted = HandUnderline.pen(at: 300, along: 300)
    let continuing = HandUnderline.pen(at: 300, along: 400)

    XCTAssertEqual(lifted, continuing - 3.5, accuracy: 0.001)
    XCTAssertEqual(
      HandUnderline.pen(at: 120, along: 300), HandUnderline.pen(at: 120, along: 900),
      "away from the end, a longer phrase keeps the same wave")
  }

  private func height(of points: [CGPoint], at x: CGFloat) -> CGFloat {
    guard let after = points.firstIndex(where: { $0.x >= x }) else {
      return points.last?.y ?? 0
    }

    guard after > 0 else {
      return points[after].y
    }

    let (left, right) = (points[after - 1], points[after])
    return left.y + (right.y - left.y) * (x - left.x) / (right.x - left.x)
  }
}
