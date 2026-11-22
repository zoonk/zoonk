import SwiftUI

struct LearnerBubble: View {
  let words: String

  var body: some View {
    if !words.isEmpty {
      ShareRow(share: 0.85, edge: .trailing) {
        Text(verbatim: words)
          .typeStyle(.body)
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(
            Color.muted,
            in: UnevenRoundedRectangle(
              topLeadingRadius: Radius.option, bottomLeadingRadius: Radius.option,
              bottomTrailingRadius: Radius.sm, topTrailingRadius: Radius.option)
          )
          .textSelection(.enabled)
      }
    }
  }
}
