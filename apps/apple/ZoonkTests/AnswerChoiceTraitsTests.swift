import SwiftUI
import XCTest

@testable import Zoonk

/// The mark that tells one answer from several is drawn only, so VoiceOver hears the kind from the
/// option's traits: a toggle, as a checkbox is, where several count, and a button that's selected
/// where one does.
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

      let picked = try XCTUnwrap(options["Sun"]).accessibilityTraits
      let other = try XCTUnwrap(options["Moon"]).accessibilityTraits
      XCTAssertEqual(picked.contains(.toggleButton), select.isMulti, "\(select)")
      XCTAssertEqual(other.contains(.toggleButton), select.isMulti, "\(select)")
      XCTAssertTrue(picked.contains(.selected), "\(select)")
      XCTAssertFalse(other.contains(.selected), "\(select)")
      window.isHidden = true
    }
  }
}
