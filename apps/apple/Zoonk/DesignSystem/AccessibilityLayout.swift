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
      .layoutStacks(isStacked)
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
    Group {
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
    .layoutStacks(isStacked)
  }
}

/// Buttons side by side. Stacked, each is a regular-size rounded rectangle as wide as the row, like
/// an alert's. `wraps` puts the ones that don't fit on the next line, as main's suggestion panel
/// does, instead of squeezing their labels.
struct ButtonRow<Content: View>: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.controlSize) private var controlSize

  var spacing: CGFloat?
  var wraps = false
  @ViewBuilder let content: Content

  var body: some View {
    Group {
      if wraps && !isStacked {
        FlowLayout(spacing: spacing ?? 8) { content }
      } else {
        AccessibilityStack(spacing: spacing) { content }
      }
    }
    .buttonSizing(isStacked ? .flexible : .automatic)
    .buttonBorderShape(isStacked ? .roundedRectangle : .automatic)
    .controlSize(isStacked && controlSize < .regular ? .regular : controlSize)
    // In a list row a stacked button otherwise gets one line's height and truncates its label.
    .fixedSize(horizontal: false, vertical: isStacked)
  }
}

/// Buttons that split a row in equal parts, one height, as main's two-column actions. When a label
/// wouldn't fit its part on one line, or text is at an accessibility size, each takes a line of its
/// own at full width, as the bottom bar's do: no label wraps to stay beside another.
struct EqualButtonRow<Content: View>: View {
  @Environment(\.stacksContent) private var isStacked

  var spacing: CGFloat = 8
  @ViewBuilder let content: Content

  var body: some View {
    EqualRowLayout(spacing: spacing, isStacked: isStacked) { content }
      .buttonSizing(.flexible)
      .controlsShareHeight()
  }
}

private struct EqualRowLayout: Layout {
  let spacing: CGFloat
  let isStacked: Bool

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0

    if let part = part(of: width, subviews) {
      return CGSize(width: width, height: rowHeight(part, subviews))
    }

    let heights = subviews.map {
      $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
    }
    return CGSize(
      width: width, height: heights.reduce(0, +) + spacing * CGFloat(max(0, subviews.count - 1)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    if let part = part(of: bounds.width, subviews) {
      let height = rowHeight(part, subviews)

      for (index, subview) in subviews.enumerated() {
        subview.place(
          at: CGPoint(x: bounds.minX + CGFloat(index) * (part + spacing), y: bounds.minY),
          proposal: ProposedViewSize(width: part, height: height))
      }
    } else {
      var y = bounds.minY

      for subview in subviews {
        let height = subview.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil)).height
        subview.place(
          at: CGPoint(x: bounds.minX, y: y),
          proposal: ProposedViewSize(width: bounds.width, height: height))
        y += height + spacing
      }
    }
  }

  /// Each button's part of the row, or nil when a label takes more lines in its part than on a
  /// line of its own. A button's ideal width can't say: its label reports the stacked size.
  private func part(of width: CGFloat, _ subviews: Subviews) -> CGFloat? {
    guard !isStacked, !subviews.isEmpty else {
      return nil
    }

    let count = CGFloat(subviews.count)
    let part = (width - spacing * (count - 1)) / count
    let wraps = subviews.contains {
      $0.sizeThatFits(ProposedViewSize(width: part, height: nil)).height
        > $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
    }

    return wraps ? nil : part
  }

  private func rowHeight(_ part: CGFloat, _ subviews: Subviews) -> CGFloat {
    subviews.map { $0.sizeThatFits(ProposedViewSize(width: part, height: nil)).height }.max() ?? 0
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
      .toggleStyle(ColumnSwitchStyle())
      .disclosureGroupStyle(.fold)
      .typeStyle(.body)
      .environment(\.barHoldsMainAction, false)
      .outsideReadableColumns()
      .environment(\.isTaskScreen, false)
      .layoutSurface()
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
  /// Less than a point: what layout's rounding takes from a measured size.
  private static let rounding: CGFloat = 1

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

    let unwrapped = title.sizeThatFits(ProposedViewSize(width: .infinity, height: nil))
    // Asked for its ideal size, a label is its title on one line: in a list row, a label measured
    // without a width reports a narrow column, which would pass a button as fitting anywhere
    // (`ViewThatFits` then picks a row that breaks its labels).
    let idealWidth = unwrapped.width.isInfinite ? nil : unwrapped.width

    guard subviews.count == 2, let icon = subviews.first else {
      let proposal = ProposedViewSize(width: proposal.width ?? idealWidth, height: proposal.height)
      return [Placement(origin: .zero, size: title.sizeThatFits(proposal), proposal: proposal)]
    }

    let iconSize = icon.sizeThatFits(.unspecified)
    let besideWidth = iconSize.width + Self.besideSpacing
    let besideProposal = ProposedViewSize(
      width: proposal.width.map { max($0 - besideWidth, 0) } ?? idealWidth, height: nil)
    let besideSize = title.sizeThatFits(besideProposal)
    // Beside the icon, the label must neither wrap nor truncate. A label that takes any width it
    // gets, like a `LabeledContent`, only has to keep its lines. Placed with the width it measured,
    // a label gets it back rounded, so a fraction of a point less still fits: otherwise a button
    // sized for its label beside the icon would place it stacked, past its own edge.
    let keepsItsWidth =
      unwrapped.width.isInfinite
      || unwrapped.width <= (besideProposal.width ?? .infinity) + Self.rounding

    if besideSize.height <= unwrapped.height + Self.rounding, keepsItsWidth {
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

/// A list row whose label has an icon and a value at its end, drawn as `ListRow` draws its (one
/// layout, `RowLayout`), and read as one label and its value.
struct IconLabeledContent<Content: View, Title: View, Icon: View>: View {
  @ViewBuilder let content: Content
  @ViewBuilder let title: Title
  @ViewBuilder let icon: Icon

  var body: some View {
    RowLayout {
      icon
    } words: {
      title
        .layoutPart(.label)
    } value: {
      content
        .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
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
