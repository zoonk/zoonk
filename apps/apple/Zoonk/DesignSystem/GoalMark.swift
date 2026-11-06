import SwiftUI

/// Main's `GoalMark`: a language goal's flag, or a goal's first letter in a small neutral square,
/// never a color per goal, since every hue already means something.
struct GoalMark: View {
  let title: String
  /// The language's flag as an emoji; nil for a goal without one.
  var flag: String?

  @ScaledMetric(relativeTo: .subheadline) private var size = 18.0

  var body: some View {
    if let flag {
      Text(verbatim: flag)
        .typeStyle(.body)
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    } else {
      letter
    }
  }

  private var letter: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.sm - 1, style: .continuous)

    return Text(verbatim: String(title.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
      .typeStyle(.small.bold())
      .foregroundStyle(Color(.foreground))
      .frame(width: size, height: size)
      .background(.muted, in: shape)
      .overlay(shape.strokeBorder(.input))
      .accessibilityHidden(true)
  }
}
