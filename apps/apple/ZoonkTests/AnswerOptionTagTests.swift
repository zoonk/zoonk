import SwiftUI
import XCTest

@testable import Zoonk

/// Before Check the mark shows the pick, so tapping a guess adds no word that could push the row
/// taller under the finger; "Your guess" comes with the verdict.
@MainActor
final class AnswerOptionTagTests: XCTestCase {
  private let words = "Nada, até aparecer um novo vendedor de ações"

  func testPickingAGuessDoesNotMakeItsRowTaller() {
    for size in [DynamicTypeSize.large, .accessibility3] {
      XCTAssertEqual(
        height(isPicked: true, result: nil, size: size),
        height(isPicked: false, result: nil, size: size), accuracy: 0.01, "\(size)")
    }
  }

  func testACheckedGuessStillSaysYourGuess() {
    XCTAssertGreaterThan(
      height(isPicked: true, result: .guess, size: .accessibility3),
      height(isPicked: false, result: nil, size: .accessibility3))
  }

  private func height(isPicked: Bool, result: AnswerOptionResult?, size: DynamicTypeSize)
    -> CGFloat
  {
    let option = AnswerOption(
      isPicked: isPicked, result: result, isGuessed: true,
      text: RichInline(text: AttributedString(words))
    ) {}
    .environment(\.dynamicTypeSize, size)
    .zoonkStyles()

    return UIHostingController(rootView: option)
      .sizeThatFits(in: CGSize(width: 358, height: CGFloat.greatestFiniteMagnitude)).height
  }
}
