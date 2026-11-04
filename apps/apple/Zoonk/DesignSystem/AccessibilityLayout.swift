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

  /// Side by side; a mark without text, such as a ring, centers instead.
  var alignment = VerticalAlignment.firstTextBaseline
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
      HStack(alignment: alignment, spacing: 12) {
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

extension View {
  /// The styles that don't reach into a presentation, so the app's root and the root of each
  /// presented screen apply them: the button shape and label style for accessibility sizes,
  /// `GroupBox` as a panel, and the type role of text without one.
  func zoonkStyles() -> some View {
    modifier(AccessibilityButtonShape())
      .labelStyle(StackingLabelStyle())
      .groupBoxStyle(.panel)
      .typeStyle(.body)
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

/// The system's label stays one view at every size, so its title grows with Dynamic Type instead of
/// being replaced when content stacks: only the icon moves, out of the label to beside or above it.
private struct StackingLabel: View {
  @Environment(\.stacksContent) private var isStacked

  let configuration: LabelStyleConfiguration

  var body: some View {
    StackingLabelLayout {
      if isStacked {
        // The system's label leaves its icon out of VoiceOver.
        configuration.icon
          .accessibilityHidden(true)
      }

      Label {
        configuration.title
      } icon: {
        if !isStacked {
          configuration.icon
        }
      }
      // The system's style: this one would draw the label again.
      .labelStyle(.automatic)
    }
  }
}

/// A label alone, or after its icon: beside it when the label fits there as it is, with the system's
/// gap beside a text title (which a `LabeledContent` title would close), and above it otherwise,
/// where the label takes the whole width.
private struct StackingLabelLayout: Layout {
  private static let besideSpacing: CGFloat = 8

  /// Like a stack, it places each view with the proposal it measured it with: proposing a wrapped
  /// text its own measured width can wrap it onto one more line than its height holds.
  private struct Placement {
    var origin: CGPoint
    var size: CGSize
    var proposal: ProposedViewSize
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    placements(for: proposal, subviews)
      .reduce(CGRect.null) { $0.union(CGRect(origin: $1.origin, size: $1.size)) }
      .size
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    for (subview, placement) in zip(subviews, placements(for: proposal, subviews)) {
      subview.place(
        at: CGPoint(x: bounds.minX + placement.origin.x, y: bounds.minY + placement.origin.y),
        proposal: placement.proposal)
    }
  }

  private func placements(for proposal: ProposedViewSize, _ subviews: Subviews) -> [Placement] {
    guard let title = subviews.last else { return [] }

    guard subviews.count == 2, let icon = subviews.first else {
      return [Placement(origin: .zero, size: title.sizeThatFits(proposal), proposal: proposal)]
    }

    let iconSize = icon.sizeThatFits(.unspecified)
    let besideWidth = iconSize.width + Self.besideSpacing
    let besideProposal = ProposedViewSize(
      width: proposal.width.map { max($0 - besideWidth, 0) }, height: nil)
    let besideSize = title.sizeThatFits(besideProposal)
    let unwrapped = title.sizeThatFits(ProposedViewSize(width: .infinity, height: nil))
    // Beside the icon, the label must neither wrap nor truncate. A label that takes any width it
    // gets, like a `LabeledContent`, only has to keep its lines.
    let keepsItsWidth =
      unwrapped.width.isInfinite || unwrapped.width <= besideProposal.width ?? .infinity

    if besideSize.height <= unwrapped.height, keepsItsWidth {
      let iconBaseline = icon.dimensions(in: .unspecified)[VerticalAlignment.firstTextBaseline]
      let titleBaseline = title.dimensions(in: besideProposal)[VerticalAlignment.firstTextBaseline]
      let baseline = max(iconBaseline, titleBaseline)

      return [
        Placement(
          origin: CGPoint(x: 0, y: baseline - iconBaseline), size: iconSize,
          proposal: .unspecified),
        Placement(
          origin: CGPoint(x: besideWidth, y: baseline - titleBaseline), size: besideSize,
          proposal: besideProposal),
      ]
    }

    let spacing = icon.spacing.distance(to: title.spacing, along: .vertical)
    let belowProposal = ProposedViewSize(width: proposal.width, height: nil)

    return [
      Placement(origin: .zero, size: iconSize, proposal: .unspecified),
      Placement(
        origin: CGPoint(x: 0, y: iconSize.height + spacing),
        size: title.sizeThatFits(belowProposal), proposal: belowProposal),
    ]
  }
}

/// A list row's `LabeledContent` whose label has an icon. In a list, a `LabeledContent` lays out a
/// `Label` in its label itself, and stacked it flows the icon into the title's first line. This
/// puts a `Label` around the `LabeledContent` instead: side by side the row looks the same, and
/// stacked the icon follows `StackingLabelStyle` like every other label's.
struct IconLabeledContent<Content: View, Title: View, Icon: View>: View {
  @ViewBuilder let content: Content
  @ViewBuilder let title: Title
  @ViewBuilder let icon: Icon

  var body: some View {
    Label {
      LabeledContent {
        content
      } label: {
        title
      }
    } icon: {
      icon
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
