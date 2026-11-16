import Charts
import SwiftUI

/// Mirrors main's `plot-scale` (`niceTicks`) and the player's `plot-ticks` and `edgeAnchor`, so a
/// chart's scale reads the same on every platform: round ticks, each label on its own tick, and
/// numbers written in full as the readout beside the chart writes them.
enum ChartsAxis {
  /// Main's `LONGEST_FULL_LABEL`: an axis shortens its ticks only when one would be longer.
  private static let longestFullLabel = 8
  /// Main's `LABEL_CHARACTER_WIDTH`: a label's width before it's drawn, generous so a guess never
  /// lets it pass an end of its axis.
  private static let labelCharacterWidth: CGFloat = 7

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

  /// Main's `edgeAnchor`: a label is centered under its tick, unless that would take it past an
  /// end of the axis; then it starts or ends at its tick.
  static func anchor(at position: CGFloat, plotWidth: CGFloat, labelWidth: CGFloat) -> UnitPoint {
    if position - labelWidth / 2 < 0 {
      return .topLeading
    }

    return position + labelWidth / 2 > plotWidth ? .topTrailing : .top
  }

  /// Where a tick's label stands on a plot `plotWidth` wide showing `domain`.
  static func anchor(
    of tick: Double, in domain: ClosedRange<Double>, plotWidth: CGFloat, label: String
  ) -> UnitPoint {
    let span = domain.upperBound - domain.lowerBound

    return anchor(
      at: span > 0 ? (tick - domain.lowerBound) / span * plotWidth : plotWidth / 2,
      plotWidth: plotWidth, labelWidth: CGFloat(label.count) * labelCharacterWidth)
  }
}

extension ChartsAxis {
  /// The axis along a chart's bottom: a label centered on each tick, and a grid line unless
  /// `showsGrid` is off. Give it the plot's width with `chartsPlotWidth(_:)` so the labels at its
  /// ends stay inside the plot.
  static func bottom(
    ticks: [Double], domain: ClosedRange<Double>, plotWidth: CGFloat, showsGrid: Bool = true,
    labelSpacing: CGFloat? = nil, label: @escaping (Double) -> String
  ) -> some AxisContent {
    AxisMarks(values: ticks) { value in
      if showsGrid {
        AxisGridLine().foregroundStyle(.vizGrid)
      }

      if let tick = value.as(Double.self) {
        let text = label(tick)

        AxisValueLabel(
          anchor: anchor(of: tick, in: domain, plotWidth: plotWidth, label: text),
          verticalSpacing: labelSpacing
        ) {
          Text(verbatim: text)
        }
      }
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
  /// Keeps the width of a chart's plot in `width`, which `ChartsAxis.bottom` needs to keep its end
  /// labels inside the plot.
  func chartsPlotWidth(_ width: Binding<CGFloat>) -> some View {
    chartBackground { proxy in
      let plotWidth = proxy.plotSize.width

      Color.clear
        .onAppear { width.wrappedValue = plotWidth }
        .onChange(of: plotWidth) { width.wrappedValue = $1 }
    }
  }
}
