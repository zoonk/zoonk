import SwiftUI

struct LearnerBubble: View {
  let words: String
  var spokenLabel: Text?

  var body: some View {
    if !words.isEmpty {
      ShareRow(share: 0.85, edge: .trailing) {
        Text(verbatim: words)
          .accessibilityLabel(spokenLabel ?? Text(verbatim: words))
          .typeStyle(.body)
          .learnerBubble()
          .textSelection(.enabled)
      }
    }
  }
}

extension View {
  /// Main's `LearnerBubble`: what the learner said, on `muted` with its corner by them tucked in.
  func learnerBubble() -> some View {
    padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(
        Color.muted,
        in: UnevenRoundedRectangle(
          topLeadingRadius: Radius.option, bottomLeadingRadius: Radius.option,
          bottomTrailingRadius: Radius.sm, topTrailingRadius: Radius.option)
      )
  }
}
