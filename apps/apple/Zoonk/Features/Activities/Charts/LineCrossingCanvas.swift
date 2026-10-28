import Charts
import SwiftUI

/// Two lines and where they cross (main's `LineCrossingActivity`): the learner drags one to explain
/// a change (a supply shock, a rent rise) and watches the crossing move. The end state is the
/// answer (which line, which way); a numeric check reads the new crossing.
struct LineCrossingCanvas: View {
  let context: ActivityCanvasContext
  let fields: LineCrossingFields

  /// How far the one moved line is, by its id; right or up is positive.
  @State private var offsets: [String: Double] = [:]
  @State private var dragOrigin: Double?
  private let format = ChartsNumberFormat()

  private var axis: LineCrossingModel.Axis { LineCrossingModel.axis(of: fields.shift.direction) }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var realOffset: Double {
    fields.shift.direction == .right || fields.shift.direction == .up
      ? fields.shift.amount : -fields.shift.amount
  }

  private func line(_ field: LineCrossingFields.Line, _ offsets: [String: Double])
    -> LineCrossingModel.Line
  {
    LineCrossingModel.moved(LineCrossingModel.line(field), by: offsets[field.id] ?? 0, axis: axis)
  }

  private func crossing(_ offsets: [String: Double]) -> LineCrossingModel.Point {
    guard fields.lines.count == 2 else {
      return .init(x: 0, y: 0)
    }

    return LineCrossingModel.crossing(
      line(fields.lines[0], offsets), line(fields.lines[1], offsets))
  }

  private var isMoved: Bool { offsets.values.contains { $0 != 0 } }

  /// After the check, when the learner's move wasn't what happened.
  private var showsAnswer: Bool {
    let ids = Set(offsets.keys).union([fields.shift.line])
    let real = [fields.shift.line: realOffset]
    return isChecked && ids.contains { (offsets[$0] ?? 0) != (real[$0] ?? 0) }
  }

  var body: some View {
    let before = crossing([:])
    let after = crossing(offsets)
    let yChange = LineCrossingModel.change(before.y, after.y)
    let xChange = LineCrossingModel.change(before.x, after.x)

    ChartsCanvas {
      LessonRichText(fields.change)
        .font(.subheadline)

      chart(after: after, changes: changeText(yChange: yChange, xChange: xChange))

      if isMoved {
        VStack(alignment: .leading, spacing: 4) {
          changeRow(fields.yLabel, change: yChange, isVertical: true)
          changeRow(fields.xLabel, change: xChange, isVertical: false)
        }
        .font(.subheadline.weight(.medium))
      } else {
        Text(
          "Drag a line by its handle.", tableName: "ActivitiesCharts",
          comment: "How to move a line on a two-line chart"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }

      if showsAnswer, let shifted = fields.lines.first(where: { $0.id == fields.shift.line }) {
        VStack(alignment: .leading, spacing: 4) {
          Text(verbatim: movedText(shifted, offset: realOffset) + ".")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.orange)

          if case .interaction = context.check, let feedback = wrongMoveFeedback {
            LessonRichText(feedback)
              .font(.subheadline)
          }
        }
      }
    }
  }

  private func chart(after: LineCrossingModel.Point, changes: String) -> some View {
    let domain = LineCrossingModel.domain(fields)
    let shifted = fields.lines.first { $0.id == fields.shift.line }

    return Chart {
      ChartsHiddenMarks {
        if isMoved {
          ForEach(fields.lines) { field in
            segmentMarks(line(field, [:]), domain: domain, series: "before-\(field.id)")
              .foregroundStyle(Color.secondary.opacity(0.5))
              .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
          }
        }

        if showsAnswer, let shifted {
          segmentMarks(
            line(shifted, [shifted.id: realOffset]), domain: domain, series: "answer"
          )
          .foregroundStyle(.orange)
          .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
        }

        ForEach(Array(fields.lines.enumerated()), id: \.element.id) { index, field in
          let segment = LineCrossingModel.segment(line(field, offsets), domain: domain)

          segmentMarks(line(field, offsets), domain: domain, series: field.id)
            .foregroundStyle(index == 0 ? Color.mint : Color.purple)
            .lineStyle(StrokeStyle(lineWidth: 2.5))

          PointMark(x: .value("x", segment.to.x), y: .value("y", segment.to.y))
            .opacity(0)
            .annotation(position: .topLeading, spacing: 2) {
              Text(verbatim: field.label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(index == 0 ? Color.mint : Color.purple)
            }
        }

        PointMark(x: .value("x", after.x), y: .value("y", after.y))
          .foregroundStyle(.primary)
          .symbolSize(70)

        RuleMark(x: .value("x", after.x), yStart: .value("y", 0), yEnd: .value("y", after.y))
          .foregroundStyle(.secondary)
          .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
        RuleMark(xStart: .value("x", 0), xEnd: .value("x", after.x), y: .value("y", after.y))
          .foregroundStyle(.secondary)
          .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
      }
    }
    .chartXScale(domain: 0...domain.x)
    .chartYScale(domain: 0...domain.y)
    .chartXAxisLabel(fields.xLabel, alignment: .trailing)
    .chartYAxisLabel(fields.yLabel, position: .top, alignment: .leading)
    .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisGridLine() } }
    .chartYAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisGridLine() } }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        if let plot = proxy.plotFrame.map({ geometry[$0] }) {
          ForEach(Array(fields.lines.enumerated()), id: \.element.id) { index, field in
            handle(field, index: index, proxy: proxy, plot: plot, domain: domain, changes: changes)
          }
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .frame(minHeight: 240)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text(verbatim: summary(changes: changes)))
  }

  private func segmentMarks(
    _ line: LineCrossingModel.Line, domain: LineCrossingModel.Point, series: String
  )
    -> some ChartContent
  {
    let segment = LineCrossingModel.segment(line, domain: domain)

    return ForEach([segment.from, segment.to], id: \.x) { point in
      LineMark(x: .value("x", point.x), y: .value("y", point.y), series: .value("line", series))
    }
  }

  private func handle(
    _ field: LineCrossingFields.Line, index: Int, proxy: ChartProxy, plot: CGRect,
    domain: LineCrossingModel.Point, changes: String
  ) -> some View {
    let segment = LineCrossingModel.segment(line(field, offsets), domain: domain)
    let share = index == 0 ? 0.8 : 0.2
    let x = segment.from.x + (segment.to.x - segment.from.x) * share
    let point = CGPoint(
      x: plot.minX + (proxy.position(forX: x) ?? 0),
      y: plot.minY + (proxy.position(forY: line(field, offsets).y(at: x)) ?? 0))
    let range = LineCrossingModel.range(fields.shift.amount)
    let offset = offsets[field.id] ?? 0

    return ChartsHandle(tint: index == 0 ? .mint : .purple, isEnabled: !isChecked)
      .chartsAdjustable(
        label: Text(
          "Move the line \(field.label)", tableName: "ActivitiesCharts",
          comment: "A line's handle on a two-line chart"),
        value: "\(movedText(field, offset: offset)). \(changes)", isEnabled: !isChecked
      ) { steps in
        move(field.id, to: offset + Double(steps) * range.step)
      }
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
          .onChanged { drag in
            let origin = dragOrigin ?? offset
            dragOrigin = origin
            let delta: Double? =
              switch axis {
              case .horizontal:
                proxy.value(atX: drag.location.x - plot.minX).flatMap { (now: Double) in
                  proxy.value(atX: drag.startLocation.x - plot.minX).map { now - $0 }
                }
              case .vertical:
                proxy.value(atY: drag.location.y - plot.minY).flatMap { (now: Double) in
                  proxy.value(atY: drag.startLocation.y - plot.minY).map { now - $0 }
                }
              }
            if let delta {
              move(field.id, to: origin + delta)
            }
          }
          .onEnded { _ in dragOrigin = nil },
        isEnabled: !isChecked
      )
      .position(point)
  }

  /// Only one line moves at a time, so the answer names one line and one direction.
  private func move(_ id: String, to raw: Double) {
    let range = LineCrossingModel.range(fields.shift.amount)
    let offset = ChartsMath.snap(raw, min: range.min, max: range.max, step: range.step)
    let next = [id: offset]

    guard next != offsets else {
      return
    }

    offsets = next

    switch context.check {
    case .interaction:
      context.setAnswer(
        offset == 0
          ? nil
          : try? ActivityAnswer(
            encoding: LineShiftAnswer(
              curve: id, direction: LineCrossingModel.direction(of: offset, axis: axis))))
    case .numeric(_, _, _, _, _, _, let output):
      let point = crossing(next)
      context.setAnswer(.numeric(output == "x" ? point.x : point.y))
    default:
      break
    }
  }

  private var wrongMoveFeedback: String? {
    guard let moved = offsets.first(where: { $0.value != 0 }) else {
      return fields.feedback.wrongLine
    }

    guard moved.key == fields.shift.line else {
      return fields.feedback.wrongLine
    }

    return LineCrossingModel.direction(of: moved.value, axis: axis) == fields.shift.direction
      ? nil : fields.feedback.wrongDirection
  }

  private func movedText(_ line: LineCrossingFields.Line, offset: Double) -> String {
    guard offset != 0 else {
      return String(
        localized: "\(line.label) hasn't moved", table: "ActivitiesCharts",
        comment: "A line on a two-line chart that wasn't moved")
    }

    switch LineCrossingModel.direction(of: offset, axis: axis) {
    case .right:
      return String(
        localized: "\(line.label) moved right", table: "ActivitiesCharts",
        comment: "A line moved right on a chart")
    case .left:
      return String(
        localized: "\(line.label) moved left", table: "ActivitiesCharts",
        comment: "A line moved left on a chart")
    case .up:
      return String(
        localized: "\(line.label) moved up", table: "ActivitiesCharts",
        comment: "A line moved up on a chart")
    case .down:
      return String(
        localized: "\(line.label) moved down", table: "ActivitiesCharts",
        comment: "A line moved down on a chart")
    }
  }

  private func changeWords(_ axisLabel: String, _ change: LineCrossingModel.Change) -> String {
    switch change {
    case .up:
      String(
        localized: "\(axisLabel) goes up", table: "ActivitiesCharts",
        comment: "What a line's move did to an axis, like Price goes up")
    case .down:
      String(
        localized: "\(axisLabel) goes down", table: "ActivitiesCharts",
        comment: "What a line's move did to an axis, like Price goes down")
    case .same:
      String(
        localized: "\(axisLabel) stays the same", table: "ActivitiesCharts",
        comment: "What a line's move did to an axis, like Price stays the same")
    }
  }

  private func changeText(yChange: LineCrossingModel.Change, xChange: LineCrossingModel.Change)
    -> String
  {
    "\(changeWords(fields.yLabel, yChange)). \(changeWords(fields.xLabel, xChange))."
  }

  private func changeRow(_ label: String, change: LineCrossingModel.Change, isVertical: Bool)
    -> some View
  {
    let symbol =
      switch change {
      case .same: "minus"
      case .up: isVertical ? "arrow.up" : "arrow.right"
      case .down: isVertical ? "arrow.down" : "arrow.left"
      }

    return Label(changeWords(label, change), systemImage: symbol)
  }

  private func summary(changes: String) -> String {
    let lines = String(
      localized:
        "A chart of two lines, \(fields.lines.first?.label ?? "") and \(fields.lines.last?.label ?? ""), with \(fields.yLabel) against \(fields.xLabel).",
      table: "ActivitiesCharts", comment: "A two-line chart, for VoiceOver")

    let state =
      isMoved
      ? "\(fields.lines.map { movedText($0, offset: offsets[$0.id] ?? 0) }.joined(separator: ". ")). \(changes)"
      : String(
        localized: "Neither line has moved yet.", table: "ActivitiesCharts",
        comment: "A two-line chart before a move, for VoiceOver")

    return "\(lines) \(state)"
  }
}
