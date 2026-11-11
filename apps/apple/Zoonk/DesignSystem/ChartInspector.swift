import SwiftUI

/// What a chart's point says in its tooltip, main's `ChartPointDetail`: its date or name, its value
/// and at most one quiet note.
struct ChartPointDetail: Equatable, Sendable {
  let label: String
  let value: String
  var note: String?

  var spoken: String {
    [label, value, note].compactMap(\.self).joined(separator: ", ")
  }
}

/// Main's `ChartTooltipContent`, the one card every chart shows a point's detail in. VoiceOver reads
/// the detail from the chart itself.
struct ChartTooltip: View {
  let detail: ChartPointDetail
  var valueColor = Color(.foreground)

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)

    VStack(alignment: .leading, spacing: 2) {
      Text(detail.label)
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)

      Text(detail.value)
        .typeStyle(.body.weight(.medium).monospacedDigit())
        .foregroundStyle(valueColor)

      if let note = detail.note {
        Text(note)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(.popover, in: shape)
    .overlay(shape.strokeBorder(.border))
    .shadow(color: .black.opacity(0.1), radius: 4, y: 3)
    .accessibilityHidden(true)
  }
}

extension ChartTooltip {
  /// Over its chart, beside the point whose frame in the chart is `anchor`. It never takes a touch.
  func placed(at anchor: CGRect, staysInside: Bool = true) -> some View {
    ChartTooltipPlacement(anchor: anchor, staysInside: staysInside) {
      self
    }
    .allowsHitTesting(false)
  }
}

/// The one point a page's charts show a tooltip for, so tapping a point in another chart moves the
/// tooltip there and a tap anywhere else closes it.
@MainActor
@Observable
final class ChartInspection {
  private var chart: Namespace.ID?
  private var index = 0

  func index(in chart: Namespace.ID) -> Int? {
    self.chart == chart ? index : nil
  }

  /// A pointer reports every move, so the same point again changes nothing.
  func inspect(_ index: Int, in chart: Namespace.ID) {
    if self.chart != chart || self.index != index {
      self.chart = chart
      self.index = index
    }
  }

  func close(_ chart: Namespace.ID? = nil) {
    if chart == nil || chart == self.chart {
      self.chart = nil
    }
  }
}

extension View {
  /// Gives the charts on this page one tooltip between them (`ChartInspection`).
  func inspectsCharts() -> some View {
    modifier(ChartInspectionScope())
  }

  /// Makes a chart one focus stop, as main's: its tooltip opens at `start` with keyboard focus, the
  /// arrow keys move it from point to point, and it closes when focus leaves.
  func chartPointKeys(
    _ keys: Set<KeyEquivalent>, in chart: Namespace.ID, from start: Int,
    target: @escaping (_ index: Int, _ key: KeyEquivalent) -> Int
  ) -> some View {
    modifier(ChartPointKeys(keys: keys, chart: chart, start: start, target: target))
  }
}

private struct ChartInspectionScope: ViewModifier {
  @State private var inspection = ChartInspection()

  func body(content: Content) -> some View {
    content
      .contentShape(.rect)
      .onTapGesture {
        inspection.close()
      }
      .onDisappear {
        inspection.close()
      }
      .environment(inspection)
  }
}

private struct ChartPointKeys: ViewModifier {
  @Environment(ChartInspection.self) private var inspection
  @FocusState private var isFocused: Bool

  let keys: Set<KeyEquivalent>
  let chart: Namespace.ID
  let start: Int
  let target: (Int, KeyEquivalent) -> Int

  func body(content: Content) -> some View {
    content
      .focusable()
      .focused($isFocused)
      .onKeyPress(keys: keys) { press in
        inspection.inspect(target(inspection.index(in: chart) ?? start, press.key), in: chart)
        return .handled
      }
      .onChange(of: isFocused) { _, isFocused in
        if isFocused {
          inspection.inspect(inspection.index(in: chart) ?? start, in: chart)
        } else {
          inspection.close(chart)
        }
      }
  }
}

/// Places a tooltip centered above its point. Where that would leave the chart it goes below the
/// point, and beside it if neither fits; a tooltip that doesn't stay inside always goes above. It
/// never crosses the chart's sides.
struct ChartTooltipPlacement: Layout {
  static let gap = 8.0
  /// Main's note wraps at 14rem inside the card's padding.
  static let maxWidth = 248.0

  let anchor: CGRect
  var staysInside = true

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    proposal.replacingUnspecifiedDimensions()
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    guard let tooltip = subviews.first else {
      return
    }

    let size = tooltip.sizeThatFits(
      ProposedViewSize(width: min(bounds.width, Self.maxWidth), height: nil))
    let origin = Self.origin(
      of: size, anchor: anchor, in: CGRect(origin: .zero, size: bounds.size),
      staysInside: staysInside)

    tooltip.place(
      at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
      proposal: ProposedViewSize(size))
  }

  static func origin(
    of size: CGSize, anchor: CGRect, in bounds: CGRect, staysInside: Bool
  ) -> CGPoint {
    let centeredX = clamp(anchor.midX - size.width / 2, bounds.minX, bounds.maxX - size.width)
    let above = CGPoint(x: centeredX, y: anchor.minY - gap - size.height)
    let below = CGPoint(x: centeredX, y: anchor.maxY + gap)

    if !staysInside || above.y >= bounds.minY {
      return above
    }

    if below.y + size.height <= bounds.maxY {
      return below
    }

    let centeredY = clamp(anchor.midY - size.height / 2, bounds.minY, bounds.maxY - size.height)

    if anchor.maxX + gap + size.width <= bounds.maxX {
      return CGPoint(x: anchor.maxX + gap, y: centeredY)
    }

    if anchor.minX - gap - size.width >= bounds.minX {
      return CGPoint(x: anchor.minX - gap - size.width, y: centeredY)
    }

    return above
  }

  /// The lower limit wins where the tooltip is larger than the room.
  private static func clamp(_ value: Double, _ lower: Double, _ upper: Double) -> Double {
    max(lower, min(value, upper))
  }
}
