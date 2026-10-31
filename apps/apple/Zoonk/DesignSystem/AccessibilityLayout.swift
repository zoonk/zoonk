import SwiftUI

/// Side by side, then stacked from the first accessibility size, where side by side each part
/// wraps a syllable a line. The HIG's stacked layout: text above what sat beside it.
struct AccessibilityStack<Content: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var alignment: VerticalAlignment = .center
  var spacing: CGFloat?
  @ViewBuilder let content: Content

  var body: some View {
    let layout =
      dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
      : AnyLayout(HStackLayout(alignment: alignment, spacing: spacing))

    layout { content }
  }
}

/// Buttons side by side. Stacked, each is a regular-size rounded rectangle as wide as the row, like
/// an alert's.
struct ButtonRow<Content: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.controlSize) private var controlSize

  var spacing: CGFloat?
  @ViewBuilder let content: Content

  var body: some View {
    let isStacked = dynamicTypeSize.isAccessibilitySize

    AccessibilityStack(spacing: spacing) { content }
      .buttonSizing(isStacked ? .flexible : .automatic)
      .buttonBorderShape(isStacked ? .roundedRectangle : .automatic)
      .controlSize(isStacked && controlSize < .regular ? .regular : controlSize)
      // In a list row a stacked button otherwise gets one line's height and truncates its label.
      .fixedSize(horizontal: false, vertical: isStacked)
  }
}

/// A section header's title with a value at its end, the value under it when they'd stack.
struct SectionHeaderRow<Trailing: View>: View {
  var alignment: VerticalAlignment = .center
  let title: Text
  @ViewBuilder let trailing: Trailing

  var body: some View {
    AccessibilityStack(alignment: alignment) {
      title
        .frame(maxWidth: .infinity, alignment: .leading)

      trailing
    }
  }
}

extension View {
  /// A wrapped capsule's round ends take the width its words need, so from the first accessibility
  /// size buttons are rounded rectangles. A button's shape doesn't reach into a presentation:
  /// apply it at the root of each presented screen too.
  func roundedButtonsAtAccessibilitySizes() -> some View {
    modifier(AccessibilityButtonShape())
  }
}

private struct AccessibilityButtonShape: ViewModifier {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  func body(content: Content) -> some View {
    content.buttonBorderShape(dynamicTypeSize.isAccessibilitySize ? .roundedRectangle : .automatic)
  }
}
