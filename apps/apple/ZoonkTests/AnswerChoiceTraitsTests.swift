import SwiftUI
import XCTest

@testable import Zoonk

/// The mark that tells one answer from several is only drawn, so VoiceOver hears the kind from the
/// option itself: where several count, a toggle that's on or off, as a checkbox is; where one
/// does, a button that's selected.
@MainActor
final class AnswerChoiceTraitsTests: XCTestCase {
  func testOnlyAPickSeveralQuestionsOptionsReadAsToggles() async throws {
    try await readsWhatVoiceOverReads()

    for (select, draft) in [
      (PracticeSelect.all, PracticeAnswer.partial([0])), (.one, .choice(0)),
    ] {
      let window = try show(
        ChoiceItemView(
          options: ["Sun", "Moon"], select: select, result: nil, isLocked: false,
          draft: .constant(draft)
        )
        .zoonkStyles())
      window.frame = CGRect(x: 0, y: 0, width: 390, height: 600)
      try await waitForLayout(in: window)

      var options: [String: NSObject] = [:]
      try await waitForTestCondition("The options did not appear") {
        options = Dictionary(
          self.accessibilityElements(in: window).filter(\.isAccessibilityElement).compactMap {
            element in element.accessibilityLabel.map { ($0, element) }
          },
          uniquingKeysWith: { first, _ in first })
        return options["Sun"] != nil && options["Moon"] != nil
      }

      let picked = try XCTUnwrap(options["Sun"])
      let other = try XCTUnwrap(options["Moon"])

      if select.isMulti {
        XCTAssertTrue(picked.accessibilityTraits.contains(.toggleButton))
        XCTAssertTrue(other.accessibilityTraits.contains(.toggleButton))
        XCTAssertEqual(picked.accessibilityValue, "1")
        XCTAssertEqual(other.accessibilityValue, "0")
      } else {
        XCTAssertFalse(picked.accessibilityTraits.contains(.toggleButton))
        XCTAssertTrue(picked.accessibilityTraits.contains(.selected))
        XCTAssertFalse(other.accessibilityTraits.contains(.selected))
      }

      window.isHidden = true
    }
  }
}
