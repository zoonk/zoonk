import Charts
import SwiftUI

struct NumberLineFields: Decodable, Hashable, Sendable {
  struct Move: Decodable, Hashable, Sendable {
    let by: Double
    let label: String?
  }

  let label: String
  let min: Double
  let max: Double
  let moves: [Move]
  let start: Double
  let step: Double
  let unit: String?

  var stops: [Double] {
    moves.reduce(into: [start]) { stops, move in stops.append((stops.last ?? start) + move.by) }
  }

  var landing: Double { stops.last ?? start }

  /// Tick values from min to max; long lines label every other tick so labels never collide.
  var ticks: [(value: Double, isLabelled: Bool)] {
    let count = Int(((max - min) / step + 1e-9).rounded(.down))
    let values = (0...Swift.max(count, 0)).map { ChartsMath.clean(min + Double($0) * step) }
    let every = values.count > 13 ? 2 : 1

    return values.enumerated().map { index, value in
      (value, index % every == 0 || value == 0)
    }
  }
}

/// The dot's position is the numeric answer, and typing a number moves the dot.
struct NumberLineCanvas: View {
  let context: ActivityCanvasContext
  let fields: NumberLineFields

  @State private var explored: Double?

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var position: Double {
    let value = context.answer?.number ?? explored ?? fields.start
    return ChartsMath.clamp(value, fields.min, fields.max)
  }

  private var jumps: [(from: Double, to: Double, label: String)] {
    guard isChecked else {
      return position == fields.start
        ? []
        : [
          (
            fields.start, position,
            ActivityNumberFormat.format(position - fields.start, signed: true)
          )
        ]
    }

    let stops = fields.stops

    return fields.moves.enumerated().map { index, move in
      (
        stops[index], stops[index + 1],
        move.label ?? ActivityNumberFormat.format(move.by, signed: true)
      )
    }
  }

  var body: some View {
    ChartsCanvas {
      Text(
        verbatim: fields.unit.map {
          String(
            localized: "\(fields.label) in \(String($0))", table: "ActivitiesCharts",
            comment: "A number line's label with its unit, like Temperature in °C")
        } ?? fields.label
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)

      chart

      ChartsReadout(text: equation)
        .accessibilityHidden(true)
    }
  }

  private var chart: some View {
    Chart {
      ChartsHiddenMarks {
        RuleMark(y: .value("line", 0))
          .foregroundStyle(.secondary)

        ForEach(Array(jumps.enumerated()), id: \.offset) { index, jump in
          ForEach(arc(from: jump.from, to: jump.to), id: \.x) { point in
            LineMark(
              x: .value("x", point.x), y: .value("y", point.y), series: .value("jump", index)
            )
            .foregroundStyle(isChecked ? Color.orange : Color.mint)
            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
            .interpolationMethod(.catmullRom)
          }

          PointMark(x: .value("x", (jump.from + jump.to) / 2), y: .value("y", arcHeight(jump)))
            .opacity(0)
            .annotation(position: .top, spacing: 2) {
              Text(verbatim: jump.label)
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(isChecked ? Color.orange : Color.mint)
            }
        }

        PointMark(x: .value("start", fields.start), y: .value("y", 0))
          .symbol(.circle)
          .symbolSize(90)
          .foregroundStyle(.secondary)

        if isChecked {
          PointMark(x: .value("landing", fields.landing), y: .value("y", 0))
            .symbol(Circle().strokeBorder(lineWidth: 3))
            .symbolSize(400)
            .foregroundStyle(.success)
        }
      }
    }
    .chartXScale(domain: fields.min...fields.max)
    .chartYScale(domain: 0...1)
    .chartYAxis(.hidden)
    .chartXAxis {
      AxisMarks(values: fields.ticks.map(\.value)) { value in
        AxisTick(
          length: value.as(Double.self) == 0 ? 12 : 6,
          stroke: StrokeStyle(lineWidth: value.as(Double.self) == 0 ? 2 : 1.5))
        if let tick = value.as(Double.self),
          fields.ticks.contains(where: { $0.value == tick && $0.isLabelled })
        {
          AxisValueLabel(verticalSpacing: 16) {
            Text(verbatim: ActivityNumberFormat.format(tick))
              .fontWeight(tick == 0 ? .semibold : .regular)
          }
        }
      }
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        if let plot = proxy.plotFrame.map({ geometry[$0] }) {
          Rectangle()
            .fill(.clear)
            .contentShape(.rect)
            .frame(width: plot.width, height: 44)
            .position(x: plot.midX, y: plot.maxY)
            .gesture(
              SpatialTapGesture(coordinateSpace: .named(ChartsPlot.space)).onEnded { tap in
                place(proxy.value(atX: tap.location.x - plot.minX))
              },
              isEnabled: !isChecked
            )
            .accessibilityHidden(true)

          ChartsHandle(tint: .mint, isEnabled: !isChecked)
            .chartsAdjustable(
              label: Text(
                "Your answer on the number line", tableName: "ActivitiesCharts",
                comment: "The number line's dot, for VoiceOver"),
              value: ActivityNumberFormat.format(position, unit: fields.unit), isEnabled: !isChecked
            ) { steps in
              place(position + Double(steps) * fields.step)
            }
            .gesture(
              DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
                .onChanged { drag in place(proxy.value(atX: drag.location.x - plot.minX)) },
              isEnabled: !isChecked
            )
            .position(x: plot.minX + (proxy.position(forX: position) ?? 0), y: plot.maxY)
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .frame(minHeight: 156)
    .padding(.top, 8)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text(verbatim: summary))
  }

  private func arcHeight(_ jump: (from: Double, to: Double, label: String)) -> Double {
    let span = Swift.max(fields.max - fields.min, 1e-9)
    return Swift.min(Swift.max(abs(jump.to - jump.from) / span * 1.6, 0.25), 0.75)
  }

  /// A jump drawn as an arc over the line: longer jumps arc higher, so a chain reads as hops.
  private func arc(from: Double, to: Double) -> [(x: Double, y: Double)] {
    let height = arcHeight((from, to, ""))

    return (0...16).map { index in
      let t = Double(index) / 16
      return (from + (to - from) * t, 4 * height * t * (1 - t))
    }
  }

  private func place(_ raw: Double?) {
    guard let raw else {
      return
    }

    let value = ChartsMath.snap(raw, min: fields.min, max: fields.max, step: fields.step)

    guard value != position else {
      return
    }

    explored = value
    context.setAnswer(.numeric(value))
  }

  private var equation: String {
    let values =
      isChecked
      ? fields.moves.map(\.by) : (position == fields.start ? [] : [position - fields.start])

    guard !values.isEmpty else {
      return ActivityNumberFormat.format(fields.start)
    }

    let terms = values.map {
      "\($0 < 0 ? "\u{2212}" : "+") \(ActivityNumberFormat.format(abs($0)))"
    }
    let end = values.reduce(fields.start, +)

    return
      "\(([ActivityNumberFormat.format(fields.start)] + terms).joined(separator: " ")) = \(ActivityNumberFormat.format(end))"
  }

  private var summary: String {
    let line = String(
      localized:
        "A number line for \(fields.label) from \(ActivityNumberFormat.format(fields.min)) to \(ActivityNumberFormat.format(fields.max)). It starts at \(ActivityNumberFormat.format(fields.start, unit: fields.unit)), and your dot is at \(ActivityNumberFormat.format(position, unit: fields.unit)).",
      table: "ActivitiesCharts", comment: "A number line, for VoiceOver")

    guard isChecked else {
      return line
    }

    let jumps = fields.moves.map { ActivityNumberFormat.format($0.by, signed: true) }.joined(
      separator: ", ")
    let landing = String(
      localized:
        "The jumps go \(jumps) and land at \(ActivityNumberFormat.format(fields.landing, unit: fields.unit)).",
      table: "ActivitiesCharts", comment: "A number line's jumps after the check, for VoiceOver")

    return "\(line) \(landing)"
  }
}
