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

  /// A Canvas label uses its measured width to stay inside its scale, as main's `edgeAnchor` does.
  static func anchor(at position: CGFloat, plotWidth: CGFloat, labelWidth: CGFloat) -> UnitPoint {
    if position - labelWidth / 2 < 0 { return .topLeading }
    return position + labelWidth / 2 > plotWidth ? .topTrailing : .top
  }
}

extension ChartsAxis {
  /// The axis along a chart's bottom: a label centered on each tick, and a grid line unless
  /// `showsGrid` is off. Native continuous-axis labels keep their centers on their ticks.
  static func bottom(
    ticks: [Double], showsGrid: Bool = true,
    labelSpacing: CGFloat? = nil, label: @escaping (Double) -> String
  ) -> some AxisContent {
    AxisMarks(preset: .aligned, position: .bottom, values: ticks) { value in
      if showsGrid {
        AxisGridLine().foregroundStyle(.vizGrid)
      }

      if let tick = value.as(Double.self) {
        let text = label(tick)

        bottomLabel(spacing: labelSpacing) {
          Text(verbatim: text)
        }
      }
    }
  }

  static func bottomLabel<Content: View>(
    spacing: CGFloat? = nil, @ViewBuilder content: () -> Content
  ) -> some AxisMark {
    AxisValueLabel(
      centered: false, horizontalSpacing: 0, verticalSpacing: spacing, content: content)
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
