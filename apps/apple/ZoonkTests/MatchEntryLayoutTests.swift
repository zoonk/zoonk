import SwiftUI
import XCTest

@testable import Zoonk

/// A pair kept mid-board would make its row taller and push every row under it down.
@MainActor
final class MatchEntryLayoutTests: XCTestCase {
  func testNoMarkMakesACardTallerThanItsWords() {
    let states: [MatchEntryState] = [
      .selected, .paired(3), .right, .done(3), .done(10), .wrong(1), .missed,
    ]

    for size in [DynamicTypeSize.large, .accessibility5] {
      let idle = height(.idle, size: size)

      for state in states {
        XCTAssertEqual(height(state, size: size), idle, accuracy: 0.01, "\(state) at \(size)")
      }
    }
  }

  private func height(_ state: MatchEntryState, size: DynamicTypeSize) -> CGFloat {
    let card = MatchEntry(state: state, action: {}) { Text(verbatim: "il martedì") }
      .environment(\.dynamicTypeSize, size)
      .zoonkStyles()

    return UIHostingController(rootView: card)
      .sizeThatFits(in: CGSize(width: 180, height: CGFloat.greatestFiniteMagnitude)).height
  }
}
