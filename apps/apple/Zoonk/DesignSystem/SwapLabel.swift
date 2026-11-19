import SwiftUI

/// Main's `SwapLabel`: a label that changes with its control's state ("Flag", "Remove flag")
/// without changing the control's width. Every label takes the same cell and only the shown one
/// is drawn and read.
struct SwapLabel: View {
  let labels: [Text]
  let shown: Int
  var alignment = Alignment.center

  var body: some View {
    ZStack(alignment: alignment) {
      ForEach(labels.indices, id: \.self) { index in
        labels[index]
          .opacity(index == shown ? 1 : 0)
          .accessibilityHidden(index != shown)
      }
    }
  }
}
