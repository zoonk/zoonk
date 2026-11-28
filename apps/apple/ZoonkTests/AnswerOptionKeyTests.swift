import SwiftUI
import XCTest

@testable import Zoonk

/// An option's number key shows only while a hardware keyboard can press it, as on the web and
/// Android; a number that isn't a key, such as an order step's place, shows either way.
@MainActor
final class AnswerOptionKeyTests: XCTestCase {
  func testAnOptionShowsItsKeyOnlyWithAKeyboard() {
    let unnumbered = picture(AnswerOption(text: words, action: {}), keyboard: true)

    XCTAssertEqual(
      picture(AnswerOption(marker: 1, text: words, action: {}), keyboard: false), unnumbered,
      "A phone with no keyboard draws no key")
    XCTAssertNotEqual(
      picture(AnswerOption(marker: 1, text: words, action: {}), keyboard: true), unnumbered,
      "A keyboard's number key draws before the words")
  }

  func testAnOrderStepKeepsItsPlaceWithoutAKeyboard() {
    XCTAssertNotEqual(
      picture(AnswerOption(marker: 2, text: words, action: nil), keyboard: false),
      picture(AnswerOption(text: words, action: nil), keyboard: false))
  }

  private let words = RichInline(text: AttributedString("Buy at the ask"))

  private func picture(_ option: AnswerOption, keyboard: Bool) -> Data? {
    let renderer = ImageRenderer(
      content: option.environment(\.hasHardwareKeyboard, keyboard).zoonkStyles())
    renderer.proposedSize = ProposedViewSize(width: 320, height: nil)
    return renderer.uiImage?.pngData()
  }
}
