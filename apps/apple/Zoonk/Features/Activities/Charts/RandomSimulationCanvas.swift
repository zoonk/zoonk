import Charts
import SwiftUI

/// The first run is seeded by the lesson, so everyone sees the same one; "Run again" draws anew.
struct RandomSimulationCanvas: View {
  let context: ActivityCanvasContext
  let fields: RandomSimulationFields

  var body: some View {
    let fieldsJSON = ChartsRandom.json(context.payload["fields"] ?? .null)

    switch fields {
    case .chance(let chance):
      ChanceSimulationView(context: context, fields: chance, fieldsJSON: fieldsJSON)
    case .sampling(let sampling):
      SamplingSimulationView(context: context, fields: sampling, fieldsJSON: fieldsJSON)
    }
  }
}

private struct RevealCount: ViewModifier {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let key: Int
  let total: Int
  @Binding var revealed: Int

  func body(content: Content) -> some View {
    content.task(id: key) {
      guard !reduceMotion else {
        revealed = total
        return
      }

      revealed = 0
      let frames = 30

      for frame in 1...frames {
        try? await Task.sleep(for: .milliseconds(33))
        guard !Task.isCancelled else { return }
        revealed = total * frame / frames
      }
    }
  }
}

private func percentText(_ share: Double) -> String {
  ActivityNumberFormat.format(share * 100, unit: "%", digits: share * 100 < 10 ? 1 : 0)
}

private struct ChanceSimulationView: View {
  let context: ActivityCanvasContext
  let fields: RandomSimulationFields.Chance
  let fieldsJSON: String

  @State private var runIndex = 0
  @State private var revealed = 0
  @State private var simulated: (seed: Int, outcomes: [Int])?

  /// The runs play once there's nothing left to guess: after the check, or explored.
  private var isRunning: Bool { context.phase != .answering }

  private var seed: Int { Int(SeededShuffle.hashSeed(fieldsJSON)) + runIndex }

  private var guess: Double? {
    guard case .choice(_, let options, _, _) = context.check, let id = context.answer?.optionId
    else {
      return nil
    }

    return options.first { $0.id == id }?.value
  }

  var body: some View {
    let outcomes = isRunning && simulated?.seed == seed ? simulated?.outcomes ?? [] : []
    let shown = Array(outcomes.prefix(revealed))
    let hits = shown.map { ChanceModel.isHit(fields.model, $0) }
    let share = hits.isEmpty ? 0 : Double(hits.filter { $0 }.count) / Double(hits.count)
    let isDone = !outcomes.isEmpty && shown.count == outcomes.count
    let runsLabel = String(
      localized: "\(ActivityNumberFormat.format(Double(fields.runs))) runs of \(fields.trialLabel)",
      table: "ActivitiesCharts",
      comment: "How many times a random trial runs, like 1,000 runs of 10 flips")

    ChartsCanvas {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: runsLabel).font(.subheadline).foregroundStyle(.secondary)
          ChartsCaption(fields.hitLabel)

          if isRunning, let guess {
            Text(
              "Your guess: \(percentText(guess))", tableName: "ActivitiesCharts",
              comment: "The learner's guess next to a simulation"
            )
            .font(.footnote.weight(.medium))
          }
        }

        Spacer()

        if isRunning {
          ChartsReadout(text: percentText(share))
            .accessibilityHidden(true)
        }
      }

      if !isRunning {
        Text(
          "Pick your guess, then check it to run the simulation.", tableName: "ActivitiesCharts",
          comment: "Before a simulation runs"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, minHeight: 128)
      } else if case .sharedBirthday = fields.model {
        runningShareChart(hits: hits)
      } else {
        histogram(all: outcomes, shown: shown)
      }

      if isDone {
        ViewThatFits(in: .horizontal) {
          HStack {
            doneSummary(share: share)
            Spacer()
            runAgain
          }
          VStack(alignment: .leading, spacing: 12) {
            doneSummary(share: share)
            runAgain
          }
        }
      }
    }
    .task(id: isRunning ? seed : nil) {
      guard isRunning else {
        return
      }

      let (model, runs, seed) = (fields.model, fields.runs, seed)
      let outcomes = await Task.detached {
        ChanceModel.run(model, runs: runs, seed: seed)
      }.value

      if !Task.isCancelled {
        simulated = (seed, outcomes)
      }
    }
    .modifier(
      RevealCount(key: outcomes.isEmpty ? -1 : seed, total: outcomes.count, revealed: $revealed)
    )
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      isRunning
        ? Text(
          "\(runsLabel): \(fields.hitLabel) came up in \(percentText(share)) of them.",
          tableName: "ActivitiesCharts", comment: "A finished simulation, for VoiceOver")
        : Text(verbatim: runsLabel))
  }

  private func doneSummary(share: Double) -> some View {
    let exact = percentText(ChanceModel.exactChance(fields.model))

    return Text(
      "\(fields.hitLabel) in \(percentText(share)) of the runs. The exact chance is \(exact).",
      tableName: "ActivitiesCharts", comment: "What a simulation found, next to the exact chance"
    )
    .font(.subheadline.monospacedDigit())
  }

  private var runAgain: some View {
    Button {
      runIndex += 1
    } label: {
      Label {
        Text(
          "Run again", tableName: "ActivitiesCharts", comment: "Runs a simulation with a new seed")
      } icon: {
        Image(systemName: "arrow.counterclockwise")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.large)
  }

  private func histogram(all: [Int], shown: [Int]) -> some View {
    let allCounts = ChanceModel.outcomeCounts(all)
    let first = allCounts.first?.outcome ?? 0
    let last = allCounts.last?.outcome ?? 1
    let isBinary = last - first == 1
    let peak = max(allCounts.map(\.count).max() ?? 1, 1)
    let bars = ChanceModel.outcomeCounts(shown).filter { $0.count > 0 }
    let hitTicks = allCounts.map(\.outcome).filter { ChanceModel.isHit(fields.model, $0) }
    let ticks = Array(Set([first, last] + (hitTicks.count == 1 ? hitTicks : []))).sorted()

    return Chart(bars, id: \.outcome) { bar in
      BarMark(x: .value("outcome", bar.outcome), y: .value("count", bar.count))
        .foregroundStyle(
          ChanceModel.isHit(fields.model, bar.outcome) ? Color.orange : Color.secondary.opacity(0.4)
        )
    }
    .chartXScale(domain: (Double(first) - 0.5)...(Double(last) + 0.5))
    .chartYScale(domain: 0...peak)
    .chartYAxis(.hidden)
    .chartXAxis {
      AxisMarks(values: ticks) { value in
        AxisValueLabel {
          if let outcome = value.as(Int.self) {
            if isBinary {
              ChanceModel.isHit(fields.model, outcome)
                ? Text("Yes", tableName: "ActivitiesCharts", comment: "A run that hit")
                : Text("No", tableName: "ActivitiesCharts", comment: "A run that missed")
            } else {
              Text(verbatim: ActivityNumberFormat.format(Double(outcome)))
            }
          }
        }
      }
    }
    .frame(minHeight: 160)
    .accessibilityHidden(true)
  }

  private func runningShareChart(hits: [Bool]) -> some View {
    Chart {
      if let guess {
        RuleMark(y: .value("guess", guess))
          .foregroundStyle(.secondary)
          .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
          .annotation(position: .top, alignment: .trailing) {
            Text(
              "Your guess: \(percentText(guess))", tableName: "ActivitiesCharts",
              comment: "The learner's guess next to a simulation"
            )
            .font(.caption2)
            .foregroundStyle(.secondary)
          }
      }

      ForEach(ChanceModel.runningShare(hits, points: 200), id: \.x) { point in
        LineMark(x: .value("run", point.x), y: .value("share", point.y))
          .foregroundStyle(.mint)
      }
    }
    .chartXScale(domain: 0...fields.runs)
    .chartYScale(domain: 0...1)
    .chartYAxis {
      AxisMarks(values: [0, 0.5, 1]) { value in
        AxisGridLine()
        AxisValueLabel {
          if let share = value.as(Double.self) {
            Text(verbatim: ActivityNumberFormat.format(share * 100, unit: "%", digits: 0))
          }
        }
      }
    }
    .chartXAxis {
      AxisMarks(values: [0, fields.runs]) { value in
        AxisValueLabel {
          if let run = value.as(Int.self) {
            Text(verbatim: ActivityNumberFormat.format(Double(run)))
          }
        }
      }
    }
    .frame(minHeight: 160)
    .accessibilityHidden(true)
  }
}

/// A size's results with what the reveal doesn't change: the middle range, the smallest size's
/// results to compare with, and the tallest bar either reaches.
private struct SamplingRun {
  let key: [Int]
  let selected: [Double]
  let range: ClosedRange<Double>
  let comparison: [SamplingModel.Bin]?
  let peak: Int

  init(key: [Int], selected: [Double], baseline: [Double]?, domain: ClosedRange<Double>) {
    self.key = key
    self.selected = selected
    range = SamplingModel.middleRange(selected)
    comparison = baseline.map { SamplingModel.histogram($0, domain: domain) }
    peak = max(
      SamplingModel.histogram(selected, domain: domain).map(\.count).max() ?? 1,
      comparison?.map(\.count).max() ?? 1, 1)
  }
}

private struct SamplingSimulationView: View {
  let context: ActivityCanvasContext
  let fields: RandomSimulationFields.Sampling
  let fieldsJSON: String

  @State private var sizeIndex: Int
  @State private var runIndex = 0
  @State private var revealed = 0
  @State private var simulated: SamplingRun?

  init(context: ActivityCanvasContext, fields: RandomSimulationFields.Sampling, fieldsJSON: String)
  {
    self.context = context
    self.fields = fields
    self.fieldsJSON = fieldsJSON
    _sizeIndex = State(initialValue: max(fields.sampleSizes.count - 1, 0))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var isShare: Bool {
    if case .proportion = fields.population { return true }
    return false
  }

  private var smallest: Int { fields.sampleSizes.first ?? 1 }
  private var size: Int {
    fields.sampleSizes.indices.contains(sizeIndex) ? fields.sampleSizes[sizeIndex] : smallest
  }

  private func seed(_ size: Int) -> Int {
    Int(SeededShuffle.hashSeed("\(fieldsJSON):\(size)")) + runIndex
  }

  private var simulationKey: [Int] { [size, seed(size), seed(smallest)] }

  private func valueText(_ value: Double, digits: Int? = nil) -> String {
    isShare
      ? ActivityNumberFormat.format(value * 100, unit: "%", digits: digits ?? 1)
      : ActivityNumberFormat.format(value, unit: fields.unit, digits: digits)
  }

  private func marginText(_ margin: Double) -> String {
    guard isShare else {
      return String(
        localized: "±\(ActivityNumberFormat.format(margin, unit: fields.unit))",
        table: "ActivitiesCharts",
        comment: "A margin of error in a measured unit, like ±2.1 cm")
    }

    let points = margin * 100
    let text = ActivityNumberFormat.format(points, digits: 1)

    if let whole = Int(exactly: (points * 10).rounded() / 10) {
      return String(
        localized: "±\(whole) points", table: "ActivitiesCharts",
        comment: "A margin of error in percentage points, like ±3 points")
    }

    return String(
      localized: "±\(text) points", table: "ActivitiesCharts",
      comment: "A margin of error in percentage points with a decimal, like ±3.5 points")
  }

  var body: some View {
    let domain = SamplingModel.domain(fields.population, smallest: smallest)
    let truth = SamplingModel.truth(fields.population)
    let run = simulated?.key == simulationKey ? simulated : nil
    let selected = run?.selected ?? []
    let shown = Array(selected.prefix(revealed))
    let isDone = !selected.isEmpty && shown.count == selected.count
    let range = run?.range ?? 0...0
    let margin = (range.upperBound - range.lowerBound) / 2
    let digits = SamplingModel.digits(margin: margin, population: fields.population)
    let bins = SamplingModel.histogram(shown, domain: domain)
    let comparison = run?.comparison
    let peak = run?.peak ?? 1
    let sizeLabel =
      fields.sizeLabel
      ?? String(localized: "Sample size", table: "ActivitiesCharts", comment: "A slider's label")

    ChartsCanvas {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top) {
          marginHeader
          Spacer()
          if run != nil {
            marginReadout(margin, isDone: isDone)
          }
        }
        VStack(alignment: .leading, spacing: 4) {
          marginHeader
          if run != nil {
            marginReadout(margin, isDone: isDone)
          }
        }
      }

      Chart {
        if let comparison {
          ForEach(comparison, id: \.from) { bin in
            RectangleMark(
              xStart: .value("from", bin.from), xEnd: .value("to", bin.to),
              yStart: .value("count", 0), yEnd: .value("count", bin.count)
            )
            .foregroundStyle(Color.secondary.opacity(0.25))
          }
        }

        ForEach(bins, id: \.from) { bin in
          RectangleMark(
            xStart: .value("from", bin.from), xEnd: .value("to", bin.to),
            yStart: .value("count", 0), yEnd: .value("count", bin.count)
          )
          .foregroundStyle(Color.mint.opacity(0.8))
        }

        if isDone {
          RectangleMark(
            xStart: .value("from", range.lowerBound), xEnd: .value("to", range.upperBound)
          )
          .foregroundStyle(Color.mint.opacity(0.1))
        }

        RuleMark(x: .value("truth", truth))
          .foregroundStyle(.orange)
          .lineStyle(StrokeStyle(lineWidth: 2))
          .annotation(position: .top) {
            Text(
              "True value: \(valueText(truth, digits: digits))", tableName: "ActivitiesCharts",
              comment: "The population's real value on a sampling chart"
            )
            .font(.caption2.weight(.medium))
            .foregroundStyle(.orange)
          }
      }
      .chartXScale(domain: domain)
      .chartYScale(domain: 0...peak)
      .chartYAxis(.hidden)
      .chartXAxis {
        AxisMarks(values: .automatic(desiredCount: 4)) { value in
          AxisGridLine()
          AxisValueLabel {
            if let x = value.as(Double.self) {
              Text(verbatim: valueText(x, digits: digits))
            }
          }
        }
      }
      .frame(minHeight: 180)
      .padding(.top, 16)
      .accessibilityHidden(true)

      if comparison != nil {
        HStack(spacing: 16) {
          legend(
            Color.secondary.opacity(0.25), text: ActivityNumberFormat.format(Double(smallest)),
            isCurrent: false)
          legend(.mint, text: ActivityNumberFormat.format(Double(size)), isCurrent: true)
        }
        .accessibilityHidden(true)
      }

      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text(verbatim: sizeLabel).font(.subheadline)
          Spacer()
          Text(verbatim: ActivityNumberFormat.format(Double(size))).font(
            .subheadline.weight(.medium).monospacedDigit())
        }

        Slider(
          value: Binding(
            get: { Double(sizeIndex) },
            set: { sizeIndex = Int($0.rounded()) }),
          in: 0...Double(max(fields.sampleSizes.count - 1, 1)), step: 1
        ) {
          Text(verbatim: sizeLabel)
        } minimumValueLabel: {
          Text(verbatim: ActivityNumberFormat.format(Double(smallest))).font(.caption)
        } maximumValueLabel: {
          Text(verbatim: ActivityNumberFormat.format(Double(fields.sampleSizes.last ?? smallest)))
            .font(.caption)
        }
        .disabled(isChecked)
        .accessibilityValue(
          Text(
            "\(ActivityNumberFormat.format(Double(size))). 95% of samples within \(marginText(margin)).",
            tableName: "ActivitiesCharts", comment: "A sample size slider's spoken value"))
      }

      ViewThatFits(in: .horizontal) {
        HStack {
          progress(shown: shown.count, isDone: isDone)
          Spacer()
          runAgain(isDone: isDone)
        }
        VStack(alignment: .leading, spacing: 12) {
          progress(shown: shown.count, isDone: isDone)
          runAgain(isDone: isDone)
        }
      }

      if isChecked {
        expectedSpread
      }
    }
    .task(id: simulationKey) {
      let key = simulationKey
      let (population, runs, size, smallest) = (fields.population, fields.runs, size, smallest)
      let (seed, smallestSeed) = (seed(size), seed(smallest))
      let domain = SamplingModel.domain(population, smallest: smallest)
      let run = await Task.detached {
        SamplingRun(
          key: key,
          selected: SamplingModel.simulate(population, runs: runs, seed: seed, size: size),
          baseline: size == smallest
            ? nil
            : SamplingModel.simulate(population, runs: runs, seed: smallestSeed, size: smallest),
          domain: domain)
      }.value

      if !Task.isCancelled {
        simulated = run
      }
    }
    .modifier(
      RevealCount(key: run == nil ? -1 : seed(size), total: selected.count, revealed: $revealed)
    )
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "\(ActivityNumberFormat.format(Double(fields.runs))) samples of \(ActivityNumberFormat.format(Double(size))) from \(fields.populationLabel). The true value is \(valueText(truth, digits: digits)); 95% of samples landed between \(valueText(range.lowerBound, digits: digits)) and \(valueText(range.upperBound, digits: digits)).",
        tableName: "ActivitiesCharts", comment: "A sampling simulation, for VoiceOver"))
  }

  private var marginHeader: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(
        "95% of samples land within", tableName: "ActivitiesCharts",
        comment: "Above a sampling simulation's margin of error"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
      ChartsCaption(fields.populationLabel)
    }
  }

  /// The margin turns soft blue once the sample is big enough: done, which is never green.
  private func marginReadout(_ margin: Double, isDone: Bool) -> some View {
    ChartsReadout(text: marginText(margin), style: isDone ? .success : .secondary)
      .accessibilityHidden(true)
  }

  private func legend(_ color: Color, text: String, isCurrent: Bool) -> some View {
    HStack(spacing: 6) {
      RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 10, height: 10)
      Text(verbatim: text)
    }
    .font(.caption.monospacedDigit().weight(isCurrent ? .medium : .regular))
    .foregroundStyle(isCurrent ? .primary : .secondary)
  }

  private func progress(shown: Int, isDone: Bool) -> some View {
    Group {
      if isDone {
        Text(
          "\(ActivityNumberFormat.format(Double(fields.runs))) samples of \(ActivityNumberFormat.format(Double(size)))",
          tableName: "ActivitiesCharts", comment: "A finished sampling run")
      } else {
        Text(
          "Running \(ActivityNumberFormat.format(Double(shown))) of \(ActivityNumberFormat.format(Double(fields.runs)))…",
          tableName: "ActivitiesCharts", comment: "A sampling run filling in"
        )
        .accessibilityHidden(true)
      }
    }
    .font(.subheadline.monospacedDigit())
    .foregroundStyle(.secondary)
  }

  private func runAgain(isDone: Bool) -> some View {
    Button {
      runIndex += 1
    } label: {
      Label {
        Text(
          "Run again", tableName: "ActivitiesCharts", comment: "Runs a simulation with a new seed")
      } icon: {
        Image(systemName: "arrow.counterclockwise")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.large)
    .disabled(!isDone)
  }

  private var expectedSpread: some View {
    let largest = fields.sampleSizes.last ?? smallest
    let ratio =
      SamplingModel.standardError(fields.population, size: largest)
      / SamplingModel.standardError(fields.population, size: smallest)

    return VStack(alignment: .leading, spacing: 8) {
      Text(
        "What the math says", tableName: "ActivitiesCharts",
        comment: "Title above the expected margins"
      )
      .font(.subheadline.weight(.medium))

      ForEach(fields.sampleSizes, id: \.self) { size in
        LabeledContent {
          Text(
            verbatim: marginText(SamplingModel.standardError(fields.population, size: size) * 1.96)
          )
          .fontWeight(.medium)
        } label: {
          Text(verbatim: ActivityNumberFormat.format(Double(size)))
        }
        .font(.subheadline.monospacedDigit())
      }

      Text(
        "From \(ActivityNumberFormat.format(Double(smallest))) to \(ActivityNumberFormat.format(Double(largest))), the margin shrinks to \(ActivityNumberFormat.format(ratio * 100, unit: "%", digits: 1)) of its size.",
        tableName: "ActivitiesCharts", comment: "How much a margin of error shrinks as samples grow"
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(.background, in: .rect(cornerRadius: 12, style: .continuous))
  }
}
