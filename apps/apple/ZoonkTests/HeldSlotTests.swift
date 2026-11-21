import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class HeldSlotTests: XCTestCase {
  func testOpeningTheGateKeepsTheClosedHeight() async throws {
    let gate = Gate()
    try show(MeasuredSlot(gate: gate))

    try await waitForTestCondition("The closed slot did not measure") {
      gate.contentHeight > 0 && gate.slotHeights.last == gate.contentHeight
    }
    let closedHeight = gate.contentHeight

    gate.isClosed = false
    try await waitForTestCondition("The shorter content did not lay out") {
      gate.contentHeight < closedHeight
    }

    XCTAssertEqual(gate.slotHeights, [closedHeight])
  }

  func testAWidthChangeWhileGatedStartsAgainFromTheNaturalHeight() async throws {
    let gate = Gate()
    try show(MeasuredSlot(gate: gate))

    try await waitForTestCondition("The narrow slot did not measure") {
      gate.contentHeight > 0 && gate.slotHeights.last == gate.contentHeight
    }
    let narrow = gate.contentHeight

    gate.width = 800
    try await waitForTestCondition("The wider slot did not shrink to the content's height") {
      gate.contentHeight < narrow && gate.slotHeights.last == gate.contentHeight
    }
  }
}

@Observable
private final class Gate {
  var isClosed = true
  var width: CGFloat = 160
  var contentHeight: CGFloat = 0
  var slotHeights: [CGFloat] = []
}

private struct MeasuredSlot: View {
  let gate: Gate

  var body: some View {
    let notice = "You'll have enough later today, or subscribe to create it now."
    HeldSlot(gated: gate.isClosed) {
      Text(verbatim: gate.isClosed ? notice : "Ready")
        .onGeometryChange(for: CGFloat.self, of: \.size.height) { gate.contentHeight = $0 }
    }
    .frame(width: gate.width)
    .onGeometryChange(for: CGFloat.self, of: \.size.height) { gate.slotHeights.append($0) }
  }
}
