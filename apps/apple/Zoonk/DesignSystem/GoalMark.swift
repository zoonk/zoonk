import SwiftUI

/// Main's `GoalMark`: a goal's first letter in a small neutral square, never a color per goal,
/// since every hue already means something.
struct GoalMark: View {
  let title: String

  @ScaledMetric(relativeTo: .subheadline) private var size = 18.0

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.sm - 1, style: .continuous)

    Text(verbatim: String(title.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
      .typeStyle(.small.bold())
      .foregroundStyle(Color(.foreground))
      .frame(width: size, height: size)
      .background(.muted, in: shape)
      .overlay(shape.strokeBorder(.input))
      .accessibilityHidden(true)
  }
}
