import Charts
import SwiftUI

struct DistributionExplorerFields: Decodable, Hashable, Sendable {
  enum Distribution: Decodable, Hashable, Sendable {
    case normal(mean: Double, sd: Double)
    case uniform(min: Double, max: Double)

    private enum CodingKeys: String, CodingKey {
      case kind, mean, sd, min, max
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      if try container.decode(String.self, forKey: .kind) == "uniform" {
        self = .uniform(
          min: try container.decode(Double.self, forKey: .min),
          max: try container.decode(Double.self, forKey: .max))
      } else {
        self = .normal(
          mean: try container.decode(Double.self, forKey: .mean),
          sd: try container.decode(Double.self, forKey: .sd))
      }
    }
  }

  struct Interval: Decodable, Hashable, Sendable {
    var from: Double
    var to: Double
  }

  let distribution: Distribution
  let handles: Interval
  let target: Interval
  let unit: String
  let valueLabel: String
}

/// Mirrors main's `distribution.ts`.
enum DistributionModel {
  private static let normalReach = 3.5
  private static let uniformMargin = 0.25
  private static let samples = 120
  private static let farSds = 40.0

  static func cumulative(_ distribution: DistributionExplorerFields.Distribution, _ value: Double)
    -> Double
  {
    switch distribution {
    case .normal(let mean, let sd):
      ChartsMath.normalCdf(mean: mean, sd: sd, value: value)
    case .uniform(let low, let high):
      ChartsMath.clamp((value - low) / (high - low), 0, 1)
    }
  }

  /// The percent of values in a range, as core's template computes the check's answer.
  static func percent(
    _ distribution: DistributionExplorerFields.Distribution,
    _ range: DistributionExplorerFields.Interval
  ) -> Double {
    (cumulative(distribution, range.to) - cumulative(distribution, range.from)) * 100
  }

  static func farEnds(_ distribution: DistributionExplorerFields.Distribution)
    -> DistributionExplorerFields.Interval
  {
    switch distribution {
    case .normal(let mean, let sd): .init(from: mean - farSds * sd, to: mean + farSds * sd)
    case .uniform(let low, let high): .init(from: low, to: high)
    }
  }

  static func density(_ distribution: DistributionExplorerFields.Distribution, _ value: Double)
    -> Double
  {
    switch distribution {
    case .uniform(let low, let high):
      value >= low && value <= high ? 1 / (high - low) : 0
    case .normal(let mean, let sd):
      exp(-pow((value - mean) / sd, 2) / 2) / (sd * (2 * Double.pi).squareRoot())
    }
  }

  static func domain(_ fields: DistributionExplorerFields) -> ClosedRange<Double> {
    let (low, high): (Double, Double) =
      switch fields.distribution {
      case .normal(let mean, let sd): (mean - normalReach * sd, mean + normalReach * sd)
      case .uniform(let min, let max):
        (min - (max - min) * uniformMargin, max + (max - min) * uniformMargin)
      }

    return min(
      low, fields.handles.from, fields.target.from)...max(
        high, fields.handles.to, fields.target.to)
  }

  private static func landmarks(_ distribution: DistributionExplorerFields.Distribution)
    -> [Double]
  {
    switch distribution {
    case .uniform(let min, let max): [min, max]
    case .normal(let mean, let sd): (-3...3).map { mean + Double($0) * sd }
    }
  }

  /// The largest round step that lands exactly on the target and, when it can, on the starting
  /// handles, the average and whole standard deviations.
  static func step(_ fields: DistributionExplorerFields, domain: ClosedRange<Double>) -> Double {
    let span = domain.upperBound - domain.lowerBound
    let top = Int(log10(span).rounded(.down))

    let candidates = (0..<5).flatMap { index in
      [5.0, 2, 1].map { $0 * pow(10, Double(top - index)) }
    }
    .filter { span / $0 >= 20 && span / $0 <= 1000 }

    let required = [fields.target.from, fields.target.to]
    let preferred =
      required + [fields.handles.from, fields.handles.to] + landmarks(fields.distribution)
    let fits = { (values: [Double], step: Double) in
      values.allSatisfy { ChartsMath.isMultiple($0, of: step) }
    }

    return candidates.first { fits(preferred, $0) } ?? candidates.first { fits(required, $0) }
      ?? candidates.last ?? span / 20
  }

  static func snapped(_ domain: ClosedRange<Double>, step: Double) -> ClosedRange<Double> {
    ((domain.lowerBound / step).rounded(.down) * step)...((domain.upperBound / step).rounded(.up)
      * step)
  }

  static func curve(
    _ distribution: DistributionExplorerFields.Distribution, _ domain: ClosedRange<Double>
  ) -> [(x: Double, y: Double)] {
    let (from, to) = (domain.lowerBound, domain.upperBound)
    var xs = (0...samples).map { from + (to - from) * Double($0) / Double(samples) }

    if case .uniform(let low, let high) = distribution {
      for edge in [low, high] where edge > from && edge < to {
        xs += [edge - 1e-9, edge + 1e-9]
      }
    }

    return xs.sorted().map { ($0, density(distribution, $0)) }
  }
}

/// With a numeric check the percent between the handles is the answer.
struct DistributionExplorerCanvas: View {
  let context: ActivityCanvasContext
  let fields: DistributionExplorerFields

  @State private var handles: DistributionExplorerFields.Interval

  init(context: ActivityCanvasContext, fields: DistributionExplorerFields) {
    self.context = context
    self.fields = fields
    _handles = State(initialValue: fields.handles)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var step: Double {
    DistributionModel.step(fields, domain: DistributionModel.domain(fields))
  }

  private var domain: ClosedRange<Double> {
    DistributionModel.snapped(DistributionModel.domain(fields), step: step)
  }

  private func percentText(_ value: Double) -> String {
    ActivityNumberFormat.format(value, unit: "%", digits: 1)
  }

  var body: some View {
    let curve = DistributionModel.curve(fields.distribution, domain)
    let between = DistributionModel.percent(fields.distribution, handles)
    let ends = DistributionModel.farEnds(fields.distribution)
    let below = DistributionModel.percent(
      fields.distribution, .init(from: ends.from, to: handles.from))
    let above = DistributionModel.percent(fields.distribution, .init(from: handles.to, to: ends.to))

    ChartsCanvas {
      HStack(alignment: .firstTextBaseline) {
        Text(
          "\(fields.valueLabel) from \(ActivityNumberFormat.format(handles.from)) to \(ActivityNumberFormat.format(handles.to))",
          tableName: "ActivitiesCharts", comment: "The range between a distribution's two handles"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)

        Spacer()

        ChartsReadout(text: percentText(between), style: .mint)
          .accessibilityHidden(true)
      }

      Chart {
        ChartsHiddenMarks {
          ForEach(curve.filter { $0.x >= handles.from && $0.x <= handles.to }, id: \.x) { point in
            AreaMark(x: .value("x", point.x), y: .value("density", point.y))
              .foregroundStyle(Color.mint.opacity(0.25))
          }

          ForEach(curve, id: \.x) { point in
            LineMark(x: .value("x", point.x), y: .value("density", point.y))
              .foregroundStyle(.primary)
          }

          if case .normal(let mean, _) = fields.distribution {
            RuleMark(x: .value("mean", mean))
              .foregroundStyle(.secondary)
              .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
          }

          if isChecked {
            ForEach([fields.target.from, fields.target.to], id: \.self) { edge in
              RuleMark(x: .value("target", edge))
                .foregroundStyle(.orange)
                .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 3]))
            }

            RuleMark(x: .value("target", (fields.target.from + fields.target.to) / 2))
              .opacity(0)
              .annotation(position: .top, alignment: .center) {
                Text(
                  verbatim:
                    "\(ActivityNumberFormat.format(fields.target.from)) – \(ActivityNumberFormat.format(fields.target.to)): \(percentText(DistributionModel.percent(fields.distribution, fields.target)))"
                )
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(.orange)
              }
          }

          RuleMark(x: .value("lower", handles.from)).foregroundStyle(.mint)
          RuleMark(x: .value("upper", handles.to)).foregroundStyle(.mint)
        }
      }
      .chartXScale(domain: domain)
      .chartYAxis(.hidden)
      .chartXAxis {
        AxisMarks(values: ticks) { value in
          AxisGridLine()
          // Below the handles that sit on the baseline.
          AxisValueLabel(verticalSpacing: 16) {
            if let x = value.as(Double.self) {
              Text(verbatim: ActivityNumberFormat.format(x))
            }
          }
        }
      }
      .chartOverlay { proxy in
        GeometryReader { geometry in
          if let plot = proxy.plotFrame.map({ geometry[$0] }) {
            tail(below)
              .frame(width: 72, alignment: .trailing)
              .position(
                x: plot.minX + (proxy.position(forX: handles.from) ?? 0) - 40, y: plot.minY + 8)
            tail(above)
              .frame(width: 72, alignment: .leading)
              .position(
                x: plot.minX + (proxy.position(forX: handles.to) ?? 0) + 40, y: plot.minY + 8)
            handle(\.from, label: lowerLabel, proxy: proxy, plot: plot, between: between)
            handle(\.to, label: upperLabel, proxy: proxy, plot: plot, between: between)
          }
        }
        .coordinateSpace(.named(ChartsPlot.space))
      }
      .frame(minHeight: 200)
      .padding(.top, 20)
      .accessibilityElement(children: .contain)
      .accessibilityLabel(Text(verbatim: summary(between: between, below: below, above: above)))
    }
  }

  private var lowerLabel: Text {
    Text("Lower handle", tableName: "ActivitiesCharts", comment: "A distribution's left handle")
  }

  private var upperLabel: Text {
    Text("Upper handle", tableName: "ActivitiesCharts", comment: "A distribution's right handle")
  }

  private var ticks: [Double] {
    switch fields.distribution {
    case .normal(let mean, let sd):
      (-3...3).map { mean + Double($0) * sd }.filter { domain.contains($0) }
    case .uniform:
      stride(
        from: domain.lowerBound, through: domain.upperBound,
        by: (domain.upperBound - domain.lowerBound) / 4
      ).map { $0 }
    }
  }

  private func tail(_ share: Double) -> some View {
    Text(verbatim: percentText(share))
      .font(.caption2.monospacedDigit())
      .foregroundStyle(.secondary)
  }

  /// A handle with its range: the lower one stops a step before the upper one, and back.
  private func handle(
    _ key: WritableKeyPath<DistributionExplorerFields.Interval, Double>, label: Text,
    proxy: ChartProxy, plot: CGRect, between: Double
  ) -> some View {
    let range =
      key == \.from
      ? domain.lowerBound...(handles.to - step) : (handles.from + step)...domain.upperBound
    let value = handles[keyPath: key]
    let x = (proxy.position(forX: value) ?? 0) + plot.minX

    return ChartsHandle(tint: .mint, isEnabled: !isChecked)
      .chartsAdjustable(
        label: label,
        value: String(
          localized:
            "\(ActivityNumberFormat.format(value, unit: fields.unit)). \(percentText(between)) between the handles.",
          table: "ActivitiesCharts", comment: "A distribution handle's spoken value"),
        isEnabled: !isChecked
      ) { steps in
        move(key, to: value + Double(steps) * step, range: range)
      }
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
          .onChanged { drag in
            if let raw: Double = proxy.value(atX: drag.location.x - plot.minX) {
              move(key, to: raw, range: range)
            }
          },
        isEnabled: !isChecked
      )
      .position(x: x, y: plot.maxY)
  }

  private func move(
    _ key: WritableKeyPath<DistributionExplorerFields.Interval, Double>, to raw: Double,
    range: ClosedRange<Double>
  ) {
    var next = handles
    next[keyPath: key] = ChartsMath.snap(
      raw, min: range.lowerBound, max: range.upperBound, step: step)

    guard next != handles else {
      return
    }

    handles = next

    if case .numeric = context.check {
      context.setAnswer(.numeric(DistributionModel.percent(fields.distribution, next)))
    }
  }

  private func summary(between: Double, below: Double, above: Double) -> String {
    let shape =
      switch fields.distribution {
      case .normal(let mean, let sd):
        String(
          localized:
            "A bell curve of \(fields.valueLabel), with an average of \(ActivityNumberFormat.format(mean, unit: fields.unit)) and a standard deviation of \(ActivityNumberFormat.format(sd, unit: fields.unit)).",
          table: "ActivitiesCharts", comment: "A normal distribution, for VoiceOver")
      case .uniform(let min, let max):
        String(
          localized:
            "A flat distribution of \(fields.valueLabel), from \(ActivityNumberFormat.format(min, unit: fields.unit)) to \(ActivityNumberFormat.format(max, unit: fields.unit)).",
          table: "ActivitiesCharts", comment: "A uniform distribution, for VoiceOver")
      }

    let shares = String(
      localized:
        "\(percentText(between)) of values fall between \(ActivityNumberFormat.format(handles.from, unit: fields.unit)) and \(ActivityNumberFormat.format(handles.to, unit: fields.unit)), \(percentText(below)) below and \(percentText(above)) above.",
      table: "ActivitiesCharts",
      comment: "The shares around a distribution's handles, for VoiceOver")

    return "\(shape) \(shares)"
  }
}
