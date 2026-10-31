import SwiftUI

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
