import SwiftUI

/// One of main's `MomentReadouts`: a result's number with its words beside it, on one baseline.
/// Several sit in a `FlowLayout(spacing: 32, alignment: .firstTextBaseline)`.
struct MomentReadout<Value: View>: View {
  var tint: Color = Color(.foreground)
  @ViewBuilder let value: () -> Value
  let words: () -> Text

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      value()
        .typeStyle(.momentReadout)
        .foregroundStyle(tint)
      words()
        .typeStyle(.body.weight(.medium))
        .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
  }
}
