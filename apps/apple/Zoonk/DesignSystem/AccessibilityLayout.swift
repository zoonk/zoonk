import SwiftUI

extension EnvironmentValues {
  /// Side-by-side content stacks from the first accessibility size, where side by side each part
  /// wraps a syllable a line. Every layout that changes when its content stacks reads this.
  var stacksContent: Bool { dynamicTypeSize.isAccessibilitySize }
}

/// Side by side, then stacked where `stacksContent` says. The HIG's stacked layout: text above what
/// sat beside it.
struct AccessibilityStack<Content: View>: View {
  @Environment(\.stacksContent) private var isStacked

  var alignment: VerticalAlignment = .center
  var spacing: CGFloat?
  var stackedSpacing: CGFloat?
  @ViewBuilder let content: Content

  var body: some View {
    let layout =
      isStacked
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: stackedSpacing ?? spacing))
      : AnyLayout(HStackLayout(alignment: alignment, spacing: spacing))

    layout { content }
  }
}

/// A mark, its text and what sits at the row's end. Stacked, the mark and the end share the first
/// line and the text takes the row's width under them.
struct MarkedRow<Mark: View, Content: View, End: View>: View {
  @Environment(\.stacksContent) private var isStacked

  var stackedSpacing: CGFloat?
  @ViewBuilder let mark: Mark
  @ViewBuilder let content: Content
  @ViewBuilder let end: End

  var body: some View {
    if isStacked {
      VStack(alignment: .leading, spacing: stackedSpacing) {
        HStack(spacing: 12) {
          mark
          Spacer(minLength: 8)
          end
        }

        content
      }
    } else {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        mark

        content
          .frame(maxWidth: .infinity, alignment: .leading)

        end
      }
    }
  }
}

/// Buttons side by side. Stacked, each is a regular-size rounded rectangle as wide as the row, like
/// an alert's.
struct ButtonRow<Content: View>: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.controlSize) private var controlSize

  var spacing: CGFloat?
  @ViewBuilder let content: Content

  var body: some View {
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
  /// The button shape and label style for accessibility sizes. Neither reaches into a
  /// presentation, so the app's root and the root of each presented screen apply them.
  func accessibilitySizeStyles() -> some View {
    modifier(AccessibilityButtonShape())
      .labelStyle(StackingLabelStyle())
  }
}

/// The system's label style until content stacks. Stacked, a list row would flow a label's icon
/// into its title's first line, which pushes aside the first line of every text and control in a
/// title of several. This one keeps the icon beside a title that fits its line and puts it above
/// one that wraps, which then takes the row's width, as in a `MarkedRow`.
struct StackingLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    StackingLabel(configuration: configuration)
  }
}

private struct StackingLabel: View {
  @Environment(\.stacksContent) private var isStacked

  let configuration: LabelStyleConfiguration

  var body: some View {
    if isStacked {
      ViewThatFits(in: .horizontal) {
        TitleAndIconLabelStyle().makeBody(configuration: configuration)

        VStack(alignment: .leading) {
          configuration.icon
          configuration.title
        }
      }
    } else {
      Label(configuration)
    }
  }
}

/// A wrapped capsule's round ends take the width its words need, so from the first accessibility
/// size buttons are rounded rectangles.
private struct AccessibilityButtonShape: ViewModifier {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  func body(content: Content) -> some View {
    content.buttonBorderShape(dynamicTypeSize.isAccessibilitySize ? .roundedRectangle : .automatic)
  }
}
