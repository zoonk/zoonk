import Foundation

struct FormulaModelFields: Decodable, Hashable, Sendable {
  struct Variable: Decodable, Hashable, Sendable {
    let name: String
    let label: String
    let initial: Double
    let min: Double
    let max: Double
    let step: Double
    let unit: String?
  }

  struct Output: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let formula: String
    let unit: String?
  }

  struct Event: Decodable, Hashable, Sendable {
    let name: String
    let label: String
  }

  struct Plot: Decodable, Hashable, Sendable {
    let x: String
    let y: String
  }

  let variables: [Variable]
  let outputs: [Output]
  let events: [Event]?
  let plot: Plot?
  let compareAt: Double?
  let title: String?

  var startingValues: [String: Double] {
    Dictionary(uniqueKeysWithValues: variables.map { ($0.name, $0.initial) })
  }

  /// Every what-if switched off, as the model starts.
  var eventsOff: [String: Double] {
    Dictionary(uniqueKeysWithValues: (events ?? []).map { ($0.name, 0) })
  }

  /// The slider the chart sweeps: the plot's x, or the first slider.
  var axis: Variable? {
    variables.first { $0.name == plot?.x } ?? variables.first
  }

  /// Core's `computeOutput`: the named output (or the plotted one) with the sliders at `inputs`,
  /// every other slider where it starts and the what-ifs off unless set. Nil when an input isn't a
  /// slider within its range.
  func value(output id: String?, inputs: [String: Double]) -> Double? {
    let outputId = id ?? plot?.y ?? outputs.first?.id

    guard let output = outputs.first(where: { $0.id == outputId }) else {
      return nil
    }

    let fixed = eventsOff
    var values = fixed

    for (name, value) in inputs where fixed[name] != nil {
      values[name] = value
    }

    let sliderInputs = inputs.filter { fixed[$0.key] == nil }
    let isReachable = sliderInputs.allSatisfy { name, value in
      variables.first { $0.name == name }.map { value >= $0.min && value <= $0.max } ?? false
    }

    guard isReachable else {
      return nil
    }

    values.merge(startingValues) { _, start in start }
    values.merge(sliderInputs) { _, input in input }

    return ActivityExpression.evaluate(output.formula, variables: values)
  }
}

/// Main's `formula-model-view.ts`: what the chart and readouts draw for the sliders and what-ifs
/// where they are now, and what they compare with.
struct FormulaModelView {
  enum BaselineKind {
    case start, whatIf
  }

  struct Baseline {
    let kind: BaselineKind
    let values: [String: Double]
  }

  struct Readout: Identifiable {
    let id: String
    let label: String
    let value: String
    let note: String?
    let isPrimary: Bool
  }

  let fields: FormulaModelFields
  let axis: FormulaModelFields.Variable
  let charted: FormulaModelFields.Output
  let sliders: [String: Double]
  let events: [String: Double]

  var now: [String: Double] { sliders.merging(events) { _, event in event } }
  var x: Double { sliders[axis.name] ?? axis.initial }

  func outputAt(_ output: FormulaModelFields.Output, _ values: [String: Double]) -> Double? {
    fields.value(output: output.id, inputs: values)
  }

  /// The charted output across the axis slider's range, everything else at `values`.
  func curve(_ values: [String: Double]) -> [(x: Double, y: Double)] {
    let samples = 64

    return (0...samples).compactMap { index in
      let x = axis.min + (axis.max - axis.min) * Double(index) / Double(samples)
      var at = values
      at[axis.name] = x
      return ActivityExpression.evaluate(charted.formula, variables: at).map { (x, $0) }
    }
  }

  /// Before the what-ifs switched on, or where the sliders started once another slider moved.
  var baseline: Baseline? {
    if events.values.contains(1) {
      return Baseline(kind: .whatIf, values: sliders.merging(fields.eventsOff) { _, off in off })
    }

    let othersMoved = fields.variables.contains {
      $0.name != axis.name && sliders[$0.name] != $0.initial
    }

    return othersMoved
      ? Baseline(kind: .start, values: fields.startingValues.merging(events) { _, event in event })
      : nil
  }

  /// The readouts compare with the start as soon as any slider moved, the chart's own included.
  var readoutBaseline: Baseline? {
    if let baseline, baseline.kind == .whatIf {
      return baseline
    }

    let moved = fields.variables.contains { sliders[$0.name] != $0.initial }

    return moved
      ? Baseline(kind: .start, values: fields.startingValues.merging(events) { _, event in event })
      : nil
  }

  var chartedNow: Double? { outputAt(charted, now) }

  var chartedBefore: Double? {
    baseline.flatMap { baseline in
      var values = baseline.values
      values[axis.name] = x
      return outputAt(charted, values)
    }
  }

  /// How much the what-ifs changed the charted output at the slider.
  var delta: Double {
    guard baseline?.kind == .whatIf, let now = chartedNow, let before = chartedBefore else {
      return 0
    }

    return now - before
  }

  var compared: (x: Double, y: Double)? {
    guard let compareAt = fields.compareAt else {
      return nil
    }

    var values = now
    values[axis.name] = compareAt
    return outputAt(charted, values).map { (compareAt, $0) }
  }

  /// One scale for every curve the learner can reach by flipping what-ifs.
  var yDomain: ClosedRange<Double> {
    let combinations = (fields.events ?? []).reduce([[String: Double]()]) { combinations, event in
      combinations.flatMap {
        [$0.merging([event.name: 0]) { $1 }, $0.merging([event.name: 1]) { $1 }]
      }
    }

    let curves =
      combinations.map { curve(sliders.merging($0) { $1 }) }
      + [baseline.map { curve($0.values) } ?? []]

    return ChartsMath.niceDomain(curves.flatMap { $0.map(\.y) })
  }

  var activeLabels: [String] {
    (fields.events ?? []).filter { events[$0.name] == 1 }.map(\.label)
  }

  func readouts() -> [Readout] {
    fields.outputs.map { output in
      let value = outputAt(output, now)
      let before = readoutBaseline.flatMap { outputAt(output, $0.values) }
      var note: String?

      if let value, let before, value != before {
        note =
          readoutBaseline?.kind == .whatIf
          ? String(
            localized: "\(ActivityNumberFormat.format(before, unit: output.unit)) before",
            table: "ActivitiesCharts",
            comment: "An output's value before the what-ifs, like $1,200 before")
          : String(
            localized:
              "\(ActivityNumberFormat.format(value - before, unit: output.unit, signed: true)) from the start",
            table: "ActivitiesCharts",
            comment: "How much an output changed, like +$300 from the start")
      }

      return Readout(
        id: output.id, label: output.label,
        value: value.map { ActivityNumberFormat.format($0, unit: output.unit) } ?? "", note: note,
        isPrimary: output.id == charted.id)
    }
  }
}
