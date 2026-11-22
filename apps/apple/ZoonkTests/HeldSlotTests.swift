import SwiftUI
import XCTest

@testable import Zoonk

/// A gate that lifts by itself keeps its slot for the visit, so nothing below moves under the
/// learner's finger, and the height it keeps belongs to the width it was measured at.
@MainActor
final class HeldSlotTests: XCTestCase {
  func testLiftingAGateHoldsTheMeasuredHeight() async throws {
    let state = SlotState(gated: true, width: 320)
    var innerHeights: [CGFloat] = []
    var outerHeights: [CGFloat] = []

    try show(
      SlotHost(state: state) { gated in
        HeldSlot(gated: gated) {
          Color.clear
            .frame(height: gated ? 120 : 24)
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { innerHeights.append($0) }
        }
        .onGeometryChange(for: CGFloat.self, of: \.size.height) { outerHeights.append($0) }
      })

    try await waitForTestCondition("The gated slot did not measure") {
      innerHeights.last == 120 && outerHeights.last == 120
    }

    state.gated = false
    try await waitForTestCondition("The lifted content did not shrink") {
      innerHeights.last == 24
    }
    XCTAssertEqual(outerHeights.last, 120)
  }

  func testAWidthChangeWhileGatedStartsAgainFromTheNaturalHeight() async throws {
    let state = SlotState(gated: true, width: 160)
    var heights: [CGFloat] = []

    try show(
      SlotHost(state: state) { gated in
        HeldSlot(gated: gated) {
          Text(verbatim: "You'll have enough later today, or subscribe to create it now.")
        }
        .onGeometryChange(for: CGFloat.self, of: \.size.height) { heights.append($0) }
      })

    try await waitForTestCondition("The slot did not measure") { !heights.isEmpty }
    let narrow = try XCTUnwrap(heights.last)

    state.width = 800
    try await waitForTestCondition("The wider slot did not shrink") {
      heights.last.map { $0 < narrow } ?? false
    }

    XCTAssertLessThan(try XCTUnwrap(heights.last), narrow)
  }
}

@Observable
private final class SlotState {
  var gated: Bool
  var width: CGFloat

  init(gated: Bool, width: CGFloat) {
    self.gated = gated
    self.width = width
  }
}

private struct SlotHost<Content: View>: View {
  let state: SlotState
  @ViewBuilder let content: (Bool) -> Content

  var body: some View {
    content(state.gated).frame(width: state.width)
  }
}
