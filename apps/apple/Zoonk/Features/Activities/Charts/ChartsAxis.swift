import Charts
import SwiftUI

/// Mirrors main's `plot-scale` (`niceTicks`) and the player's `plot-ticks`, so a
/// chart's scale reads the same on every platform: round ticks, each label on its own tick, and
/// numbers written in full as the readout beside the chart writes them.
enum ChartsAxis {
  /// Main's `LONGEST_FULL_LABEL`: an axis shortens its ticks only when one would be longer.
  private static let longestFullLabel = 8

  /// Main's `niceTicks`: the round values inside a domain, about `count` steps apart.
  static func ticks(_ domain: ClosedRange<Double>, count: Int = 4) -> [Double] {
    let step = ChartsMath.niceStep(domain.upperBound - domain.lowerBound, count: count)

    guard step.isFinite else {
      return []
    }

    let first = ChartsMath.clean(domain.lowerBound / step).rounded(.up) * step
    let total = Int(ChartsMath.clean((domain.upperBound - first) / step).rounded(.down))

    return total < 0 ? [] : (0...total).map { ChartsMath.clean(first + Double($0) * step) }
  }

  /// Main's `tickLabels`: every tick is written in full ("$10,000", not "$10K"), unless the longest
  /// wouldn't fit; then all of them are written short together.
  static func isShort(_ ticks: [Double], format: (Double, _ isShort: Bool) -> String) -> Bool {
    (ticks.map { format($0, false).count }.max() ?? 0) > longestFullLabel
  }

  /// A tick label uses its measured width to stay inside its scale, as main's `edgeAnchor` does.
  static func anchor(at position: CGFloat, plotWidth: CGFloat, labelWidth: CGFloat) -> UnitPoint {
    if position - labelWidth / 2 < 0 { return .topLeading }
    return position + labelWidth / 2 > plotWidth ? .topTrailing : .top
  }
}

extension ChartsAxis {
  /// The axis along a chart's bottom: a label centered on each tick, and a grid line unless
  /// `showsGrid` is off. The measured edge rule keeps end labels inside the plot.
  @MainActor static func bottom(
    ticks: [Double], showsGrid: Bool = true,
    labelSpacing: CGFloat? = nil, label: @escaping (Double) -> String
  ) -> some AxisContent {
    AxisMarks(preset: .aligned, position: .bottom, values: ticks) { value in
      if showsGrid {
        AxisGridLine().foregroundStyle(.vizGrid)
      }

      if let tick = value.as(Double.self) {
        let text = label(tick)

        bottomLabel(value: tick, spacing: labelSpacing) {
          Text(verbatim: text)
        }
      }
    }
  }

  @MainActor static func bottomLabel<Content: View>(
    value: Double, spacing: CGFloat? = nil, @ViewBuilder content: () -> Content
  ) -> some AxisMark {
    AxisValueLabel(
      centered: false, horizontalSpacing: 0, verticalSpacing: spacing
    ) {
      ChartsAxisEdgeLabel(value: value, content: content)
    }
  }

  /// The value axis along a chart's start, as main draws it: a grid line on each tick and its label
  /// ending just before the plot, so the numbers line up on their last digit.
  static func values(ticks: [Double], label: @escaping (Double) -> String) -> some AxisContent {
    AxisMarks(position: .leading, values: ticks) { value in
      AxisGridLine().foregroundStyle(.vizGrid)

      if let tick = value.as(Double.self) {
        AxisValueLabel(anchor: .trailing, horizontalSpacing: 8) {
          Text(verbatim: label(tick))
        }
      }
    }
  }
}

extension View {
  func chartsXAxis<Axis: AxisContent>(@AxisContentBuilder content: @escaping () -> Axis)
    -> some View
  {
    modifier(ChartsBottomAxis(axis: content))
  }
}

private struct ChartsAxisPlot: Equatable, Sendable {
  var width: CGFloat = 0
  var lower: Double = 0
  var upper: Double = 1
  var start: CGFloat = 0
  var end: CGFloat = 0

  func position(_ value: Double) -> CGFloat {
    start + CGFloat((value - lower) / (upper - lower)) * (end - start)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var chartsAxisPlot = ChartsAxisPlot()
}

private struct ChartsBottomAxis<Axis: AxisContent>: ViewModifier {
  let axis: () -> Axis
  @State private var plot = ChartsAxisPlot()

  func body(content: Content) -> some View {
    content
      .chartXAxis(content: axis)
      .chartBackground { proxy in
        let domain = proxy.xDomain(dataType: Double.self)
        let lower = domain.first
        let upper = domain.last
        let start = lower.flatMap { proxy.position(forX: $0) }
        let end = upper.flatMap { proxy.position(forX: $0) }
        let frame = proxy.plotFrame
        Color.clear.onGeometryChange(for: ChartsAxisPlot.self) { geometry in
          guard let lower, let upper, upper != lower, let start, let end, let frame
          else { return ChartsAxisPlot() }
          return ChartsAxisPlot(
            width: geometry[frame].width, lower: lower, upper: upper, start: start, end: end)
        } action: {
          plot = $0
        }
      }
      .environment(\.chartsAxisPlot, plot)
  }
}

private struct ChartsAxisEdgeLabel<Content: View>: View {
  let value: Double
  @ViewBuilder let content: Content
  @Environment(\.chartsAxisPlot) private var plot

  var body: some View {
    let plot = self.plot
    let value = self.value
    content.visualEffect { content, geometry in
      let anchor = ChartsAxis.anchor(
        at: plot.position(value), plotWidth: plot.width, labelWidth: geometry.size.width)
      // Aligned axis marks center the container even when an explicit anchor is supplied.
      return content.offset(x: geometry.size.width * (0.5 - anchor.x))
    }
  }
}
