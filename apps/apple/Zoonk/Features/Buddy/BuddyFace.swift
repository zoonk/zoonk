import SwiftUI

/// The buddy's face wherever the app shows it beside words (Ask buttons, pickers): main's buddy
/// cropped to its face, grown by the learner's belt, happy, at the size of the text beside it, so it
/// follows Dynamic Type and sits on the text's line like the symbol a `Label` would show. It holds
/// still and is decorative.
struct BuddyFace: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let kind: BuddyKind
  var glasses: BuddyGlasses = .round

  private var look: BuddyLook {
    var look = learner.summary.value?.buddy ?? BuddyLook()
    look.kind = kind
    look.glasses = glasses
    return look
  }

  var body: some View {
    Image(systemName: "circle.fill")
      .imageScale(.large)
      .hidden()
      .overlay {
        BuddyCharacter(look: look, expression: .happy, crop: .face)
      }
      .accessibilityHidden(true)
  }
}
