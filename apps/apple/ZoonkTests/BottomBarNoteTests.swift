import SwiftUI
import XCTest

@testable import Zoonk

/// A bottom bar's note floats over the screen above its buttons: whole however many lines it
/// takes, and never over the buttons.
@MainActor
final class BottomBarNoteTests: XCTestCase {
  private static let oneLine = "Saved."
  private static let twoLines =
    "That didn't go through. Your answers are saved. Try again in a moment."

  func testATwoLineNoteShowsWholeAboveTheButton() async throws {
    let one = try await note(Self.oneLine, size: .large)
    let two = try await note(Self.twoLines, size: .large)

    XCTAssertGreaterThan(two.line.height, one.line.height * 1.5, "Both lines show")
    XCTAssertLessThanOrEqual(two.line.maxY, two.button.minY)
  }

  func testANoteAtAnAccessibilitySizeShowsWholeAboveTheButton() async throws {
    let one = try await note(Self.oneLine, size: .accessibility3)
    let two = try await note(Self.twoLines, size: .accessibility3)

    XCTAssertGreaterThan(two.line.height, one.line.height * 1.5, "Every line shows")
    XCTAssertLessThanOrEqual(two.line.maxY, two.button.minY)
  }

  private func note(_ message: String, size: DynamicTypeSize) async throws -> (
    line: CGRect, button: CGRect
  ) {
    try readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack {
        ZoonkList {
          Section { Text(verbatim: "Row") }
        }
        .bottomBar(note: BarNote(message)) {
          Button {
          } label: {
            Text(verbatim: "Continue")
          }
          .buttonStyle(.mainAction)
        }
      }
      .dynamicTypeSize(size)
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 402, height: 874)
    try await waitForLayout(in: window)

    var line: NSObject?
    var button: NSObject?
    try await waitForTestCondition("The note never showed: \(spoken(in: window))") {
      let elements = self.accessibilityElements(in: window)
      line = elements.first { $0.accessibilityLabel == message }
      button = elements.first {
        $0.accessibilityLabel == "Continue" && $0.accessibilityTraits.contains(.button)
      }
      return line != nil && button != nil
    }
    window.isHidden = true
    return (
      try XCTUnwrap(line).accessibilityFrame, try XCTUnwrap(button).accessibilityFrame
    )
  }
}
