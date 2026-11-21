import Charts
import SwiftUI

/// The end state is the answer (which line, which way); a numeric check reads the new crossing.
struct LineCrossingCanvas: View {
  let context: ActivityCanvasContext
  let fields: LineCrossingFields

  /// How far the one moved line is, by its id; right or up is positive.
  @ActivityState private var offsets: [String: Double]
  @State private var dragOrigin: Double?

  init(context: ActivityCanvasContext, fields: LineCrossingFields) {
    self.context = context
    self.fields = fields
    _offsets = ActivityState(
      wrappedValue: LineCrossingModel.restoredOffsets(fields, answer: context.answer), "offsets")
  }

  private var axis: LineCrossingModel.Axis { LineCrossingModel.axis(of: fields.shift.direction) }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var realOffset: Double {
    LineCrossingModel.offset(fields.shift.amount, toward: fields.shift.direction)
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
        .typeStyle(.body)

      chart(after: after, changes: changeText(yChange: yChange, xChange: xChange))

      if isMoved {
        VStack(alignment: .leading, spacing: 4) {
          changeRow(fields.yLabel, change: yChange)
          changeRow(fields.xLabel, change: xChange)
        }
        .typeStyle(.body.weight(.medium))
        .accessibilityHidden(true)
      } else {
        dragHint
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      if showsAnswer, let shifted = fields.lines.first(where: { $0.id == fields.shift.line }) {
        VStack(alignment: .leading, spacing: 4) {
          Text(verbatim: movedText(shifted, offset: realOffset))
            .typeStyle(.body.weight(.semibold))
            .foregroundStyle(Color.successText)

          if case .interaction = context.check, let feedback = wrongMoveFeedback {
            LessonRichText(feedback)
              .typeStyle(.body)
          }
        }
      }
    }
  }

  private func chart(after: LineCrossingModel.Point, changes: String) -> some View {
    let domain = LineCrossingModel.domain(fields)
    let shifted = fields.lines.first { $0.id == fields.shift.line }

    return Chart {
      if isMoved {
        ForEach(fields.lines.filter { offsets[$0.id, default: 0] != 0 }) { field in
          segmentMarks(line(field, [:]), domain: domain, series: "before-\(field.id)")
            .foregroundStyle(Color.mutedForeground.opacity(0.5))
            .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
        }
      }

      if showsAnswer, let shifted {
        segmentMarks(
          line(shifted, [shifted.id: realOffset]), domain: domain, series: "answer"
        )
        .foregroundStyle(Color.success)
        .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
      }

      ForEach(Array(fields.lines.enumerated()), id: \.element.id) { index, field in
        segmentMarks(line(field, offsets), domain: domain, series: field.id)
          .foregroundStyle(index == 0 ? Color.vizHighlight : Color.vizSecondary)
          .lineStyle(StrokeStyle(lineWidth: 2.5))

      }

      RuleMark(
        x: .value(verbatim: "x", after.x), yStart: .value(verbatim: "y", 0),
        yEnd: .value(verbatim: "y", after.y)
      )
      .foregroundStyle(.mutedForeground)
      .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
      RuleMark(
        xStart: .value(verbatim: "x", 0), xEnd: .value(verbatim: "x", after.x),
        y: .value(verbatim: "y", after.y)
      )
      .foregroundStyle(.mutedForeground)
      .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))

      // After its guide lines, so their dashes end under it instead of across it.
      PointMark(x: .value(verbatim: "x", after.x), y: .value(verbatim: "y", after.y))
        .foregroundStyle(.primary)
        .symbolSize(70)
    }
    .chartXScale(domain: 0...domain.x)
    .chartYScale(domain: 0...domain.y)
    .chartPlotStyle { plot in plot.frame(minHeight: 248).clipped() }
    .chartsXAxis(domain: 0...domain.x) { ActivityNumberFormat.format($0) }
    .chartYAxis {
      ChartsAxis.values(ticks: ChartsAxis.ticks(0...domain.y)) { ActivityNumberFormat.format($0) }
    }
    .chartsMarksHidden()
    .chartOverlay { proxy in
      GeometryReader { geometry in
        if let plot = proxy.plotFrame.map({ geometry[$0] }) {
          let point = { (value: LineCrossingModel.Point) in
            CGPoint(
              x: plot.minX + (proxy.position(forX: value.x) ?? 0),
              y: plot.minY + (proxy.position(forY: value.y) ?? 0))
          }
          let segment = { (value: LineCrossingModel.Line) in
            let ends = LineCrossingModel.segment(value, domain: domain)
            return LineCrossingLabelLayout.Segment(from: point(ends.from), to: point(ends.to))
          }
          let names = fields.lines.enumerated().map { index, field in
            LineCrossingLabels.Item(
              id: field.id, text: Text(verbatim: field.label),
              segment: segment(line(field, offsets)),
              color: index == 0 ? .vizHighlight : .vizSecondary)
          }
          let beforeNames = fields.lines.filter { offsets[$0.id, default: 0] != 0 }.map { field in
            LineCrossingLabels.Item(
              id: "before-\(field.id)", text: Text("Before", tableName: "ActivitiesCharts"),
              segment: segment(line(field, [:])), color: .mutedForeground,
              isUpper: false, isOptional: true)
          }
          let revealed =
            shifted.flatMap { field -> LineCrossingLabels.Item? in
              guard showsAnswer else { return nil }
              return .init(
                id: "answer", text: Text("What happened", tableName: "ActivitiesCharts"),
                segment: segment(line(field, [field.id: realOffset])), color: .successText,
                isUpper: false)
            }.map { [$0] } ?? []
          let handles = fields.lines.enumerated().map { index, field in
            let center = point(handlePosition(field, index: index, plot: plot, domain: domain))
            let radius = ChartsHandle.radius + 3
            return CGRect(
              x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
          }
          let cross = point(after)
          LineCrossingLabels(
            items: names + beforeNames + revealed, shownCount: names.count + beforeNames.count,
            plot: plot,
            guides: [
              .init(from: CGPoint(x: cross.x, y: plot.maxY), to: cross),
              .init(from: CGPoint(x: plot.minX, y: cross.y), to: cross),
            ], obstacles: handles + [CGRect(x: cross.x - 7, y: cross.y - 7, width: 14, height: 14)]
          )
          ForEach(Array(fields.lines.enumerated()), id: \.element.id) { index, field in
            handle(field, index: index, proxy: proxy, plot: plot, domain: domain, changes: changes)
          }
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .chartsPlotText()
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text(verbatim: summary(changes: changes)))
    .chartsAxisTitles(
      x: fields.xLabel, y: fields.yLabel,
      values: ChartsAxis.ticks(0...domain.y).map { ActivityNumberFormat.format($0) })
  }

  private func segmentMarks(
    _ line: LineCrossingModel.Line, domain: LineCrossingModel.Point, series: String
  )
    -> some ChartContent
  {
    let segment = LineCrossingModel.segment(line, domain: domain)

    return ForEach([segment.from, segment.to], id: \.x) { point in
      LineMark(
        x: .value(verbatim: "x", point.x), y: .value(verbatim: "y", point.y),
        series: .value(verbatim: "line", series))
    }
  }

  private func handlePosition(
    _ field: LineCrossingFields.Line, index: Int, plot: CGRect, domain: LineCrossingModel.Point
  ) -> LineCrossingModel.Point {
    LineCrossingModel.handlePoint(
      line(field, offsets), domain: domain,
      share: index == 0 ? 0.8 : 0.2, plot: .init(x: plot.width, y: plot.height),
      radius: ChartsHandle.radius)
  }

  private func handle(
    _ field: LineCrossingFields.Line, index: Int, proxy: ChartProxy, plot: CGRect,
    domain: LineCrossingModel.Point, changes: String
  ) -> some View {
    let position = handlePosition(field, index: index, plot: plot, domain: domain)
    let point = CGPoint(
      x: plot.minX + (proxy.position(forX: position.x) ?? 0),
      y: plot.minY + (proxy.position(forY: position.y) ?? 0))
    let range = LineCrossingModel.range(fields.shift.amount)
    let offset = offsets[field.id] ?? 0

    return ChartsHandle(tint: index == 0 ? .vizHighlight : .vizSecondary, isEnabled: !isChecked)
      .chartsAdjustable(
        label: Text(
          "Move the line \(field.label)", tableName: "ActivitiesCharts",
          comment: "A line's handle on a two-line chart"),
        value: [movedText(field, offset: offset), changes].joinedSentences(), isEnabled: !isChecked
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
        localized: "\(line.label) hasn't moved.", table: "ActivitiesCharts",
        comment: "A line on a two-line chart that wasn't moved")
    }

    switch LineCrossingModel.direction(of: offset, axis: axis) {
    case .right:
      return String(
        localized: "\(line.label) moved right.", table: "ActivitiesCharts",
        comment: "A line moved right on a chart")
    case .left:
      return String(
        localized: "\(line.label) moved left.", table: "ActivitiesCharts",
        comment: "A line moved left on a chart")
    case .up:
      return String(
        localized: "\(line.label) moved up.", table: "ActivitiesCharts",
        comment: "A line moved up on a chart")
    case .down:
      return String(
        localized: "\(line.label) moved down.", table: "ActivitiesCharts",
        comment: "A line moved down on a chart")
    }
  }

  /// An axis's label is a name, not a sentence's subject, so each change is its label and a value.
  private func changeWords(_ axisLabel: String, _ change: LineCrossingModel.Change) -> String {
    switch change {
    case .up: String(localized: "\(axisLabel): up", table: "ActivitiesCharts")
    case .down: String(localized: "\(axisLabel): down", table: "ActivitiesCharts")
    case .same: String(localized: "\(axisLabel): no change", table: "ActivitiesCharts")
    }
  }

  private var dragHint: Text {
    axis == .horizontal
      ? Text("Drag a line left or right by its handle.", tableName: "ActivitiesCharts")
      : Text("Drag a line up or down by its handle.", tableName: "ActivitiesCharts")
  }

  /// Main's `toSentence`: VoiceOver reads each change as its own sentence, ended with the app
  /// language's full stop.
  private func sentence(_ text: String) -> String {
    if let last = text.last, ".!?…。！？".contains(last) {
      return text
    }

    let language = Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en").language
    return text + (language.languageCode == .japanese ? "。" : ".")
  }

  private func changeText(yChange: LineCrossingModel.Change, xChange: LineCrossingModel.Change)
    -> String
  {
    [changeWords(fields.yLabel, yChange), changeWords(fields.xLabel, xChange)].map(sentence)
      .joinedSentences()
  }

  private func changeRow(_ label: String, change: LineCrossingModel.Change) -> some View {
    let symbol =
      switch change {
      case .same: "minus"
      case .up: "arrow.up"
      case .down: "arrow.down"
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
      ? fields.lines.map { movedText($0, offset: offsets[$0.id] ?? 0) } + [changes]
      : [
        String(
          localized: "Neither line has moved yet.", table: "ActivitiesCharts",
          comment: "A two-line chart before a move, for VoiceOver")
      ]

    return ([lines] + state).joinedSentences()
  }
}

private struct LineCrossingLabels: View {
  struct Item: Identifiable {
    let id: String
    let text: Text
    let segment: LineCrossingLabelLayout.Segment
    let color: Color
    var isUpper = true
    var isOptional = false
  }

  let items: [Item]
  let shownCount: Int
  let plot: CGRect
  let guides: [LineCrossingLabelLayout.Segment]
  let obstacles: [CGRect]

  var body: some View {
    LineCrossingNamesLayout(
      items: items, shownCount: shownCount, plot: plot, guides: guides, obstacles: obstacles
    ) {
      ForEach(items) { item in
        item.text
          .typeStyle(.meta.weight(.semibold))
          .foregroundStyle(item.color)
          .chartsLabelHalo()
          .clipped()
          #if DEBUG
            .modifier(LineCrossingNameFrameReporter(id: item.id))
          #endif
      }
    }
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }
}

private struct LineCrossingNamesLayout: Layout {
  let items: [LineCrossingLabels.Item]
  let shownCount: Int
  let plot: CGRect
  let guides: [LineCrossingLabelLayout.Segment]
  let obstacles: [CGRect]

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    CGSize(width: proposal.width ?? plot.maxX, height: proposal.height ?? plot.maxY)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let area = plot.insetBy(dx: 3, dy: 3)
    let labels = zip(items, subviews).enumerated().map { index, pair in
      let (item, view) = pair
      // The revealed name can wrap into the space between the names already shown.
      let width = index < shownCount ? area.width : area.width / 2
      return LineCrossingLabelLayout.Label(
        segment: item.segment,
        size: view.sizeThatFits(ProposedViewSize(width: max(1, width), height: nil)),
        isUpper: item.isUpper, isOptional: item.isOptional)
    }
    let boxes = LineCrossingLabelLayout.chart(
      shown: Array(labels.prefix(shownCount)), revealed: Array(labels.dropFirst(shownCount)),
      in: area, guides: guides, obstacles: obstacles)
    for (view, box) in zip(subviews, boxes) {
      guard let box else {
        view.place(at: .zero, proposal: .zero)
        continue
      }
      view.place(
        at: CGPoint(x: bounds.minX + box.minX, y: bounds.minY + box.minY), anchor: .topLeading,
        proposal: ProposedViewSize(width: box.width, height: box.height))
    }
  }
}

#if DEBUG
  /// A class, so the environment compares it by identity rather than redrawing for a new closure.
  @MainActor final class LineCrossingNameFrames {
    let report: (String, CGRect) -> Void

    init(_ report: @escaping (String, CGRect) -> Void) { self.report = report }
  }

  extension EnvironmentValues {
    @Entry var lineCrossingNameFrame: LineCrossingNameFrames?
  }

  private struct LineCrossingNameFrameReporter: ViewModifier {
    let id: String
    @Environment(\.lineCrossingNameFrame) private var report

    func body(content: Content) -> some View {
      if let report {
        content.onGeometryChange(for: CGRect.self) {
          $0.frame(in: .global)
        } action: {
          report.report(id, $0)
        }
      } else {
        content
      }
    }
  }
#endif
