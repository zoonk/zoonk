import Charts
import SwiftUI

/// A model of formulas to play with (main's `FormulaModelActivity`): sliders drive the outputs, and
/// one output is drawn across one slider's range. What-ifs switch on and off over the sliders, and
/// a dashed curve keeps how things were before them, or where the sliders started. Values come
/// from the same formulas core grades with, so the readouts and a numeric check agree.
struct FormulaModelCanvas: View {
  let context: ActivityCanvasContext
  let fields: FormulaModelFields

  @State private var sliders: [String: Double]
  @State private var events: [String: Double]

  init(context: ActivityCanvasContext, fields: FormulaModelFields) {
    self.context = context
    self.fields = fields
    _sliders = State(initialValue: fields.startingValues)
    _events = State(initialValue: fields.eventsOff)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  /// The output the chart draws: the one the check reads, the plotted one, or the first.
  private var charted: FormulaModelFields.Output? {
    let asked: String? =
      switch context.check {
      case .choice(_, _, _, let output), .numeric(_, _, _, _, _, _, let output): output
      default: nil
      }

    let id = asked ?? fields.plot?.y
    return fields.outputs.first { $0.id == id } ?? fields.outputs.first
  }

  var body: some View {
    if let axis = fields.axis, let charted {
      let view = FormulaModelView(
        fields: fields, axis: axis, charted: charted, sliders: sliders, events: events)
      board(view)
    }
  }

  private func board(_ view: FormulaModelView) -> some View {
    let readouts = view.readouts()

    return ChartsCanvas {
      if let title = fields.title {
        ChartsCaption(title)
      }

      if let modelEvents = fields.events, !modelEvents.isEmpty {
        FlowLayout {
          ForEach(modelEvents, id: \.name) { event in
            Toggle(
              isOn: Binding(
                get: { events[event.name] == 1 },
                set: { update(sliders, events.merging([event.name: $0 ? 1 : 0]) { $1 }) })
            ) {
              Label(event.label, systemImage: events[event.name] == 1 ? "checkmark" : "plus")
            }
            .toggleStyle(.button)
            .buttonStyle(.bordered)
            .disabled(isChecked)
          }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
          Text(
            "What-if events", tableName: "ActivitiesCharts", comment: "A group of what-if switches")
        )
      }

      readoutGrid(readouts)

      if let compared = view.compared {
        Text(
          "\(view.charted.label) at \(ActivityNumberFormat.format(compared.x, unit: view.axis.unit)): \(ActivityNumberFormat.format(compared.y, unit: view.charted.unit))",
          tableName: "ActivitiesCharts",
          comment: "An output at a marked value, like Savings at 10 years: $1,600"
        )
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.orange)
      }

      chart(view)

      if let baseline = view.baseline {
        legend(baseline.kind)
      }

      ForEach(fields.variables, id: \.name) { variable in
        slider(variable, view: view)
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text(verbatim: description(view, readouts: readouts)))
  }

  private func readoutGrid(_ readouts: [FormulaModelView.Readout]) -> some View {
    LazyVGrid(
      columns: [GridItem(.adaptive(minimum: 140), alignment: .topLeading)], alignment: .leading,
      spacing: 12
    ) {
      ForEach(readouts) { item in
        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: item.label).font(.footnote).foregroundStyle(.secondary)
          ChartsReadout(text: item.value, style: item.isPrimary ? .mint : .primary)
          if let note = item.note {
            Text(verbatim: note).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
          }
        }
      }
    }
    .accessibilityHidden(true)
  }

  private func chart(_ view: FormulaModelView) -> some View {
    let current = view.curve(view.now)
    let expected = expectedPoint(view)

    return Chart {
      if let baseline = view.baseline {
        ForEach(view.curve(baseline.values), id: \.x) { point in
          LineMark(
            x: .value("x", point.x), y: .value("y", point.y), series: .value("curve", "before")
          )
          .foregroundStyle(.secondary)
          .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
        }
      }

      ForEach(current, id: \.x) { point in
        LineMark(x: .value("x", point.x), y: .value("y", point.y), series: .value("curve", "now"))
          .foregroundStyle(.mint)
          .lineStyle(StrokeStyle(lineWidth: 2.5))
      }

      if let compared = view.compared {
        PointMark(x: .value("x", compared.x), y: .value("y", compared.y))
          .foregroundStyle(.orange)
          .symbolSize(60)
      }

      if let now = view.chartedNow {
        RuleMark(x: .value("x", view.x))
          .foregroundStyle(.secondary.opacity(0.5))
        PointMark(x: .value("x", view.x), y: .value("y", now))
          .foregroundStyle(.mint)
          .symbolSize(90)
          .annotation(position: .top, spacing: 4) {
            if view.delta != 0 {
              Text(
                verbatim: ActivityNumberFormat.format(
                  view.delta, unit: view.charted.unit, signed: true)
              )
              .font(.caption.weight(.semibold).monospacedDigit())
              .foregroundStyle(.mint)
            }
          }
      }

      if let expected {
        PointMark(x: .value("x", expected.x), y: .value("y", expected.y))
          .symbol(Circle().strokeBorder(lineWidth: 2.5))
          .symbolSize(260)
          .foregroundStyle(.success)
      }
    }
    .chartXScale(domain: view.axis.min...view.axis.max)
    .chartYScale(domain: view.yDomain)
    .chartXAxis {
      AxisMarks(values: .automatic(desiredCount: 4)) { value in
        AxisGridLine()
        AxisValueLabel {
          if let x = value.as(Double.self) {
            Text(verbatim: ActivityNumberFormat.format(x, unit: view.axis.unit))
          }
        }
      }
    }
    .chartYAxis {
      AxisMarks(values: .automatic(desiredCount: 4)) { value in
        AxisGridLine()
        AxisValueLabel {
          if let y = value.as(Double.self) {
            Text(verbatim: ActivityNumberFormat.format(y, unit: view.charted.unit, compact: true))
          }
        }
      }
    }
    .frame(minHeight: 200)
    .accessibilityHidden(true)
  }

  /// Where the check's answer sits on the chart once checked: its slider position and value.
  private func expectedPoint(_ view: FormulaModelView) -> (x: Double, y: Double)? {
    guard isChecked, case .numeric(_, let answer, _, _, _, let inputs, _) = context.check else {
      return nil
    }

    let x = inputs?.first { $0.name == view.axis.name }?.value ?? view.axis.initial
    return (x, answer)
  }

  private func legend(_ kind: FormulaModelView.BaselineKind) -> some View {
    HStack(spacing: 16) {
      HStack(spacing: 6) {
        Capsule().fill(.mint).frame(width: 16, height: 3)
        kind == .whatIf
          ? Text(
            "With the what-ifs", tableName: "ActivitiesCharts", comment: "Legend of the solid curve"
          )
          : Text("Now", tableName: "ActivitiesCharts", comment: "Legend of the solid curve")
      }
      HStack(spacing: 6) {
        Capsule().fill(.secondary).frame(width: 16, height: 2)
        kind == .whatIf
          ? Text(
            "Before", tableName: "ActivitiesCharts",
            comment: "Legend of the dashed curve before the what-ifs")
          : Text(
            "At the start", tableName: "ActivitiesCharts",
            comment: "Legend of the dashed curve where sliders started")
      }
    }
    .font(.caption)
    .foregroundStyle(.secondary)
    .accessibilityHidden(true)
  }

  private func slider(_ variable: FormulaModelFields.Variable, view: FormulaModelView) -> some View
  {
    let value = sliders[variable.name] ?? variable.initial
    let output =
      view.chartedNow.map { ActivityNumberFormat.format($0, unit: view.charted.unit) } ?? ""

    return VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .firstTextBaseline) {
        Text(verbatim: variable.label).font(.subheadline)
        Spacer()
        Text(verbatim: ActivityNumberFormat.format(value, unit: variable.unit))
          .font(.subheadline.weight(.medium).monospacedDigit())
      }

      Slider(
        value: Binding(
          get: { value },
          set: { next in
            let snapped = ChartsMath.snap(
              next, min: variable.min, max: variable.max, step: variable.step)
            if snapped != value {
              update(sliders.merging([variable.name: snapped]) { $1 }, events)
            }
          }),
        in: variable.min...variable.max
      ) {
        Text(verbatim: variable.label)
      } minimumValueLabel: {
        Text(verbatim: ActivityNumberFormat.format(variable.min, unit: variable.unit)).font(
          .caption
        ).foregroundStyle(
          .secondary)
      } maximumValueLabel: {
        Text(verbatim: ActivityNumberFormat.format(variable.max, unit: variable.unit)).font(
          .caption
        ).foregroundStyle(
          .secondary)
      }
      .disabled(isChecked)
      .accessibilityValue(
        Text(
          "\(ActivityNumberFormat.format(value, unit: variable.unit)). \(view.charted.label): \(output)",
          tableName: "ActivitiesCharts",
          comment: "A model slider's spoken value with the output it drives"))
    }
  }

  private func update(_ nextSliders: [String: Double], _ nextEvents: [String: Double]) {
    sliders = nextSliders
    events = nextEvents

    guard case .numeric(_, _, _, _, _, _, let output) = context.check else {
      return
    }

    let inputs = nextSliders.merging(nextEvents) { $1 }
    context.setAnswer(fields.value(output: output, inputs: inputs).map { .numeric($0) })
  }

  private func description(_ view: FormulaModelView, readouts: [FormulaModelView.Readout]) -> String
  {
    var parts = [
      String(
        localized: "Sliders and a chart of \(view.charted.label) across \(view.axis.label).",
        table: "ActivitiesCharts", comment: "A formula model, for VoiceOver")
    ]

    if let events = fields.events, !events.isEmpty {
      parts.append(
        view.activeLabels.isEmpty
          ? String(
            localized: "No what ifs switched on.", table: "ActivitiesCharts",
            comment: "For VoiceOver")
          : String(
            localized: "What ifs switched on: \(view.activeLabels.joined(separator: ", ")).",
            table: "ActivitiesCharts", comment: "For VoiceOver"))
    }

    parts += readouts.map { item in
      item.note.map {
        String(
          localized: "\(item.label): \(item.value), \($0).", table: "ActivitiesCharts",
          comment: "An output and its change, for VoiceOver")
      }
        ?? String(
          localized: "\(item.label): \(item.value).", table: "ActivitiesCharts",
          comment: "An output's value, for VoiceOver")
    }

    if let compared = view.compared {
      parts.append(
        String(
          localized:
            "For comparison, at \(ActivityNumberFormat.format(compared.x, unit: view.axis.unit)) it's \(ActivityNumberFormat.format(compared.y, unit: view.charted.unit)).",
          table: "ActivitiesCharts",
          comment: "A marked comparison on a model's chart, for VoiceOver"))
    }

    return parts.joined(separator: " ")
  }
}
