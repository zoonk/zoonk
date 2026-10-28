import Charts
import SwiftUI

struct ChartReaderFields: Decodable, Hashable, Sendable {
  struct Point: Decodable, Hashable, Sendable {
    let x: Double
    let y: Double
  }

  struct Span: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let from: Double
    let to: Double
  }

  enum Statistic: String, Decodable, Sendable {
    case change, percentChange, ratePerUnit
  }

  let points: [Point]
  let spans: [Span]
  let statistic: Statistic
  let xLabel: String
  let yLabel: String
  let yUnit: String?

  func y(at x: Double) -> Double? {
    points.first { $0.x == x }?.y
  }

  /// Core's `measureSpan`: the change, percent change or rate across a span; the first span when
  /// none is named.
  func measure(_ spanId: String?) -> Double? {
    let span = spanId.flatMap { id in spans.first { $0.id == id } } ?? spans.first

    guard let span, let start = y(at: span.from), let end = y(at: span.to) else {
      return nil
    }

    switch statistic {
    case .change: return end - start
    case .ratePerUnit: return (end - start) / (span.to - span.from)
    case .percentChange: return start == 0 ? nil : (end - start) / start * 100
    }
  }

  /// Years and other whole labels up to four digits read without a thousands separator.
  var hasPlainX: Bool {
    points.allSatisfy { $0.x.rounded() == $0.x && abs($0.x) < 10_000 }
  }
}

/// A real dataset to measure (main's `ChartReaderActivity`): the learner taps spans to see how much
/// the line changed in each, so a trend is read from the data instead of stated. With a numeric
/// check the last measured span is the answer; after the check the asked span is marked.
struct ChartReaderCanvas: View {
  let context: ActivityCanvasContext
  let fields: ChartReaderFields

  @State private var selected: [String] = []
  private let format = ChartsNumberFormat()

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var targetId: String? {
    guard case .numeric(_, _, _, _, _, _, let output) = context.check else {
      return nil
    }

    return output ?? fields.spans.first?.id
  }

  private var shownSpans: [ChartReaderFields.Span] {
    fields.spans.filter { selected.contains($0.id) || (isChecked && $0.id == targetId) }
  }

  var body: some View {
    ChartsCanvas {
      Text(verbatim: fields.yLabel)
        .font(.subheadline.weight(.medium))

      chart
        .accessibilityRepresentation { Text(verbatim: summary) }

      ChartsCaption(fields.xLabel)

      Text(
        "Tap a span to measure it", tableName: "ActivitiesCharts", comment: "Above a chart's spans"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)

      LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 8)], spacing: 8) {
        ForEach(fields.spans) { span in
          Button {
            toggle(span.id)
          } label: {
            Text(verbatim: span.label)
          }
          .buttonStyle(ChartsChoiceStyle(state: state(of: span)))
          .disabled(isChecked)
          .accessibilityAddTraits(selected.contains(span.id) ? .isSelected : [])
          .accessibilityValue(Text(verbatim: measureText(span) ?? ""))
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text("Spans to measure", tableName: "ActivitiesCharts", comment: "Group of a chart's spans")
      )
    }
  }

  private var chart: some View {
    Chart {
      ForEach(shownSpans) { span in
        RectangleMark(xStart: .value("From", span.from), xEnd: .value("To", span.to))
          .foregroundStyle(Color.purple.opacity(0.12))
      }

      ForEach(fields.points, id: \.x) { point in
        LineMark(x: .value(fields.xLabel, point.x), y: .value(fields.yLabel, point.y))
          .foregroundStyle(.primary)
          .lineStyle(StrokeStyle(lineWidth: 2))
      }

      ForEach(shownSpans) { span in
        ForEach([span.from, span.to], id: \.self) { x in
          PointMark(x: .value("x", x), y: .value("y", fields.y(at: x) ?? 0))
            .foregroundStyle(.purple)
            .symbolSize(60)
        }

        if let text = measureText(span) {
          PointMark(
            x: .value("x", (span.from + span.to) / 2),
            y: .value("y", max(fields.y(at: span.from) ?? 0, fields.y(at: span.to) ?? 0))
          )
          .opacity(0)
          .annotation(position: .top, spacing: 4) {
            Text(verbatim: text)
              .font(.caption.weight(.semibold).monospacedDigit())
              .foregroundStyle(.purple)
          }
        }
      }
    }
    .chartXScale(domain: (fields.points.first?.x ?? 0)...(fields.points.last?.x ?? 1))
    .chartYScale(domain: .automatic(includesZero: false))
    .chartXAxis {
      AxisMarks(values: .automatic(desiredCount: 4)) { value in
        AxisGridLine()
        AxisValueLabel {
          if let x = value.as(Double.self) {
            Text(verbatim: format(x, grouping: !fields.hasPlainX))
          }
        }
      }
    }
    .chartYAxis {
      AxisMarks(values: .automatic(desiredCount: 4)) { value in
        AxisGridLine()
        AxisValueLabel {
          if let y = value.as(Double.self) {
            Text(verbatim: format(y, compact: true))
          }
        }
      }
    }
    .frame(minHeight: 184)
  }

  private func state(of span: ChartReaderFields.Span) -> ChartsChoiceStyle.State {
    if isChecked && span.id == targetId {
      return .right
    }

    return selected.contains(span.id) ? .selected : .plain
  }

  private func toggle(_ spanId: String) {
    if selected.contains(spanId) {
      selected.removeAll { $0 == spanId }
    } else {
      selected.append(spanId)
    }

    guard case .numeric = context.check else {
      return
    }

    context.setAnswer(selected.last.flatMap { fields.measure($0) }.map { .numeric($0) })
  }

  private func measureText(_ span: ChartReaderFields.Span) -> String? {
    guard let value = fields.measure(span.id) else {
      return nil
    }

    switch fields.statistic {
    case .percentChange:
      return format(value, unit: "%", signed: true)
    case .change:
      return format(value, unit: fields.yUnit, signed: true)
    case .ratePerUnit:
      let change = format(value, unit: fields.yUnit, signed: true)
      return String(
        localized: "\(change) per \(fields.xLabel)", table: "ActivitiesCharts",
        comment: "A rate on a chart, like +2.4 ppm per year")
    }
  }

  private var summary: String {
    let first = fields.points.first
    let last = fields.points.last
    let line = String(
      localized:
        "A line chart of \(fields.yLabel) by \(fields.xLabel), from \(format(first?.y ?? 0, unit: fields.yUnit)) at \(format(first?.x ?? 0, grouping: !fields.hasPlainX)) to \(format(last?.y ?? 0, unit: fields.yUnit)) at \(format(last?.x ?? 0, grouping: !fields.hasPlainX)).",
      table: "ActivitiesCharts", comment: "What a chart reader's line shows, for VoiceOver")

    let spans = shownSpans.compactMap { span in
      measureText(span).map { change in
        String(
          localized: "\(span.label): \(change).", table: "ActivitiesCharts",
          comment: "A measured span on a chart, for VoiceOver")
      }
    }

    return ([line] + spans).joined(separator: " ")
  }
}
