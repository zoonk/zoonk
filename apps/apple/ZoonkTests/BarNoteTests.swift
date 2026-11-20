import SwiftUI
import XCTest

@testable import Zoonk

/// A bottom bar's note sits over its buttons, never on them.
@MainActor
final class BarNoteTests: XCTestCase {
  func testTheNoteEndsAboveTheButton() async throws {
    try await readsWhatVoiceOverReads()

    for width in [402.0, 1032.0] {
      let window = try show(
        NavigationStack {
          List {
            Text(verbatim: "Row")
          }
          .bottomBar(note: BarNote("That didn't go through.")) {
            Button {
            } label: {
              Text(verbatim: "Continue")
            }
            .buttonStyle(.mainAction)
          }
        }
        .zoonkStyles())
      window.frame = CGRect(x: 0, y: 0, width: width, height: 874)
      try await waitForLayout(in: window)

      let elements = accessibilityElements(in: window)
      let note = try XCTUnwrap(
        elements.first { $0.accessibilityLabel?.contains("That didn't go through.") == true })
      let button = try XCTUnwrap(elements.first { $0.accessibilityLabel == "Continue" })
      XCTAssertLessThanOrEqual(
        note.accessibilityFrame.maxY, button.accessibilityFrame.minY,
        "At \(width) pt the note \(note.accessibilityFrame) covers the button \(button.accessibilityFrame)"
      )
    }
  }
}
