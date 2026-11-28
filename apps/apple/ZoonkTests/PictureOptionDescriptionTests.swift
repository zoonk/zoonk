import SwiftUI
import XCTest

@testable import Zoonk

/// A picture option whose picture never came is described in the picture's box, which grows with
/// the words and keeps 32pt above and below them, so they never run under the corner key or pick
/// mark.
@MainActor
final class PictureOptionDescriptionTests: XCTestCase {
  private let short = "A red apple"
  private let long =
    "Uma pessoa segura um celular com o app da corretora aberto, mostrando o preço de uma ação que sobe e desce ao longo do dia"

  /// Two columns of 173pt, 8pt inside each card, 8pt inside the box.
  private let listWidth: CGFloat = 358
  private let wordsWidth: CGFloat = 141

  func testALongDescriptionKeepsItsWordsClearOfTheCorners() {
    let words = height(of: Text(long).typeStyle(.body), width: wordsWidth)
    let card = height(of: options(long), width: listWidth)

    XCTAssertGreaterThanOrEqual(card, words + 2 * 32 + 2 * 8)
  }

  func testAShortDescriptionKeepsThePictureSquare() {
    XCTAssertEqual(
      height(of: options(short), width: listWidth), 173, accuracy: 1)
  }

  private func options(_ alt: String) -> some View {
    LessonOptionList(
      options: [
        LessonOption(id: "a", text: "a", pictureAlt: alt),
        LessonOption(id: "b", text: "b", pictureAlt: short),
      ],
      selectedId: nil, isChecked: false, isLocked: false, select: { _ in })
  }

  private func height(of view: some View, width: CGFloat) -> CGFloat {
    UIHostingController(rootView: view.zoonkStyles())
      .sizeThatFits(in: CGSize(width: width, height: CGFloat.greatestFiniteMagnitude)).height
  }
}
