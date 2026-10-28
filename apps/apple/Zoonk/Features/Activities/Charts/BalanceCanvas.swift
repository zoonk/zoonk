import SwiftUI

/// An equation as a balance (main's `BalanceActivity`): the learner takes the same thing off both
/// pans and watches it stay level, until one unknown stands alone and its weight is the answer.
/// Taking from one side only tips the beam and shows the writer's hint. Equations bags and blocks
/// can't draw are solved one move at a time in symbols instead.
struct BalanceCanvas: View {
  let context: ActivityCanvasContext
  let fields: BalanceFields

  var body: some View {
    let start = BalanceModel.parse(
      left: fields.equation.left, right: fields.equation.right, variable: fields.variable)
    let solution = start.flatMap(BalanceModel.solve)

    ChartsCanvas {
      if let start, let solution, BalanceModel.canDrawBlocks(start, solution: solution) {
        BlockBalance(context: context, fields: fields, start: start, solution: solution)
      } else {
        SymbolicBalance(context: context, fields: fields, start: start)
      }
    }
  }
}

private func equationText(_ state: BalanceModel.State, symbol: String) -> (
  left: String, right: String
) {
  (
    BalanceModel.text(state.left, symbol: symbol) { ActivityNumberFormat.format($0) },
    BalanceModel.text(state.right, symbol: symbol) { ActivityNumberFormat.format($0) }
  )
}

private struct BlockBalance: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let context: ActivityCanvasContext
  let fields: BalanceFields
  let start: BalanceModel.State
  let solution: Double

  @State private var current: BalanceModel.State
  @State private var history: [BalanceModel.State] = []
  @State private var wrongMoves = 0

  init(
    context: ActivityCanvasContext, fields: BalanceFields, start: BalanceModel.State,
    solution: Double
  ) {
    self.context = context
    self.fields = fields
    self.start = start
    self.solution = solution
    _current = State(initialValue: start)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var tilt: Double { BalanceModel.tilt(current, solution: solution) }

  var body: some View {
    let sides = equationText(current, symbol: fields.unknown.symbol)
    let hint =
      fields.hints.isEmpty
      ? nil
      : fields.hints[
        ((wrongMoves - 1) % fields.hints.count + fields.hints.count) % fields.hints.count
      ].hint

    BalanceScale(state: current, tilt: tilt, unknown: fields.unknown.symbol)
      .animation(reduceMotion ? nil : .snappy, value: current)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(verbatim: description(sides)))

    Text(verbatim: "\(sides.left) \(tilt == 0 ? "=" : "≠") \(sides.right)")
      .font(.title3.weight(.semibold).monospaced())
      .frame(maxWidth: .infinity)
      .accessibilityHidden(true)

    if tilt != 0, let hint {
      LessonRichText(hint)
        .font(.subheadline)
        .foregroundStyle(.orange)
    }

    if !isChecked {
      controls
    }

    BalanceSteps(steps: stepRows, reached: reached, showsAll: isChecked)
  }

  private var stepStates: [BalanceModel.State?] {
    fields.steps.map {
      BalanceModel.parse(left: $0.left, right: $0.right, variable: fields.variable)
    }
  }

  private var reached: Int {
    BalanceModel.reachedSteps(
      current: current, history: history, solution: solution, steps: stepStates)
  }

  private var stepRows: [(move: String, equation: String)] {
    zip(fields.steps, stepStates).map { step, state in
      let text =
        state.map { equationText($0, symbol: fields.unknown.symbol) } ?? (
          left: step.left, right: step.right
        )
      return (step.move, "\(text.left) = \(text.right)")
    }
  }

  private var controls: some View {
    VStack(spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        panControls(.left)
        panControls(.right)
      }

      ViewThatFits(in: .horizontal) {
        HStack {
          splitButton
          undoButton
        }
        VStack(alignment: .leading) {
          splitButton
          undoButton
        }
      }
    }
  }

  private func panControls(_ side: BalanceModel.Side) -> some View {
    let pan = side == .left ? current.left : current.right

    return VStack(alignment: .leading, spacing: 6) {
      side == .left
        ? Text("Left side", tableName: "ActivitiesCharts", comment: "A balance's left pan")
        : Text("Right side", tableName: "ActivitiesCharts", comment: "A balance's right pan")

      HStack(spacing: 8) {
        takeButton(fields.unknown, side: side, isEnabled: pan.x >= 1) { handle(.takeX(side)) }
        takeButton(fields.unit, side: side, isEnabled: pan.units >= 1) { handle(.takeUnit(side)) }
      }
    }
    .font(.footnote.weight(.medium))
    .foregroundStyle(.secondary)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func takeButton(
    _ object: BalanceFields.Object, side: BalanceModel.Side, isEnabled: Bool,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Text(verbatim: "\u{2212}\(object.symbol)")
        .font(.body.weight(.semibold).monospaced())
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.bordered)
    .controlSize(.large)
    .disabled(!isEnabled)
    .accessibilityLabel(
      side == .left
        ? Text(
          "Take off the left side: \(object.label)", tableName: "ActivitiesCharts",
          comment: "Takes one thing off a balance's left pan")
        : Text(
          "Take off the right side: \(object.label)", tableName: "ActivitiesCharts",
          comment: "Takes one thing off a balance's right pan"))
  }

  @ViewBuilder
  private var splitButton: some View {
    if tilt == 0, let groups = BalanceModel.splitGroups(current) {
      Button {
        handle(.split(groups))
      } label: {
        Text(
          "Split both sides into \(groups) equal groups", tableName: "ActivitiesCharts",
          comment: "Divides both pans of a balance by the number of bags")
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
    }
  }

  private var undoButton: some View {
    Button {
      update(history.last ?? start, history: Array(history.dropLast()))
    } label: {
      Label {
        Text("Undo", tableName: "ActivitiesCharts", comment: "Undoes the last move")
      } icon: {
        Image(systemName: "arrow.uturn.backward")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.large)
    .disabled(history.isEmpty)
  }

  private func handle(_ move: BalanceModel.Move) {
    let next = BalanceModel.apply(move, to: current)

    if BalanceModel.tilt(next, solution: solution) != 0 && tilt == 0 {
      wrongMoves += 1
    }

    update(next, history: history + [current])
  }

  private func update(_ next: BalanceModel.State, history: [BalanceModel.State]) {
    current = next
    self.history = history
    context.setAnswer(BalanceModel.isolatedValue(next).map { .numeric($0) })
  }

  private func description(_ sides: (left: String, right: String)) -> String {
    let pans = String(
      localized: "A balance. Left pan: \(sides.left). Right pan: \(sides.right).",
      table: "ActivitiesCharts", comment: "A balance, for VoiceOver")
    let state =
      tilt == 0
      ? String(
        localized: "The pans are level.", table: "ActivitiesCharts", comment: "For VoiceOver")
      : tilt > 0
        ? String(
          localized: "The right pan is heavier.", table: "ActivitiesCharts",
          comment: "For VoiceOver")
        : String(
          localized: "The left pan is heavier.", table: "ActivitiesCharts", comment: "For VoiceOver"
        )

    return "\(pans) \(state)"
  }
}

/// The beam on its stand with a pan of bags and blocks at each end; it tips toward the heavier pan.
private struct BalanceScale: View {
  let state: BalanceModel.State
  let tilt: Double
  let unknown: String

  var body: some View {
    let lift = CGFloat(sin(tilt * .pi / 180)) * 70

    VStack(spacing: 0) {
      HStack(alignment: .bottom, spacing: 24) {
        pan(state.left, isHeavier: tilt < 0)
          .offset(y: lift)
        pan(state.right, isHeavier: tilt > 0)
          .offset(y: -lift)
      }
      .frame(minHeight: 120, alignment: .bottom)

      Capsule()
        .fill(.primary)
        .frame(height: 4)
        .rotationEffect(.degrees(tilt))
        .padding(.horizontal, 8)

      Triangle()
        .fill(.secondary)
        .frame(width: 28, height: 24)
    }
    .padding(.vertical, 8)
  }

  private func pan(_ pan: BalanceModel.Pan, isHeavier: Bool) -> some View {
    VStack(spacing: 4) {
      if isHeavier {
        Text("Heavier", tableName: "ActivitiesCharts", comment: "Over the heavier pan of a balance")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.orange)
      }

      FlowLayout(spacing: 3) {
        ForEach(0..<max(Int(pan.x), 0), id: \.self) { _ in
          Text(verbatim: unknown)
            .font(.subheadline.weight(.bold).italic())
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .frame(minWidth: 30, minHeight: 38)
            .background(Color.purple, in: .rect(cornerRadius: 8, style: .continuous))
        }

        if pan.units.rounded() == pan.units && pan.units <= 12 {
          ForEach(0..<max(Int(pan.units), 0), id: \.self) { _ in
            RoundedRectangle(cornerRadius: 3, style: .continuous)
              .fill(Color.orange.opacity(0.8))
              .frame(width: 18, height: 18)
          }
        } else if pan.units > 0 {
          Text(verbatim: ActivityNumberFormat.format(pan.units))
            .font(.caption.weight(.semibold).monospacedDigit())
            .padding(.horizontal, 8)
            .frame(minHeight: 28)
            .background(Color.orange.opacity(0.8), in: .rect(cornerRadius: 6))
        }
      }
      .frame(maxWidth: .infinity, alignment: .bottom)

      Capsule().fill(.secondary).frame(height: 3)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct Triangle: Shape {
  func path(in rect: CGRect) -> Path {
    Path { path in
      path.move(to: CGPoint(x: rect.midX, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
      path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
      path.closeSubpath()
    }
  }
}

/// For equations bags and blocks can't show (negatives, fractions, big counts): the learner picks
/// each next move in symbols. A wrong move shows the writer's hint, and the equation only changes
/// on a right move, so the balance stays true.
private struct SymbolicBalance: View {
  let context: ActivityCanvasContext
  let fields: BalanceFields
  let start: BalanceModel.State?

  @State private var reached = 0
  @State private var hint: String?

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var steps: [(move: String, equation: String, state: BalanceModel.State?)] {
    fields.steps.map { step in
      let state = BalanceModel.parse(left: step.left, right: step.right, variable: fields.variable)
      let text =
        state.map { equationText($0, symbol: fields.variable) } ?? (
          left: step.left, right: step.right
        )
      return (step.move, "\(text.left) = \(text.right)", state)
    }
  }

  var body: some View {
    let steps = steps
    let startText =
      start.map { equationText($0, symbol: fields.variable) } ?? (
        fields.equation.left, fields.equation.right
      )
    let current = reached > 0 ? steps[reached - 1].equation : "\(startText.0) = \(startText.1)"

    Text(verbatim: current)
      .font(.title3.weight(.semibold).monospaced())
      .frame(maxWidth: .infinity)

    if reached < steps.count && !isChecked {
      VStack(spacing: 8) {
        ForEach(
          BalanceModel.moveChoices(
            next: steps[reached].move, wrongMoves: fields.hints.map(\.move), index: reached),
          id: \.self
        ) { move in
          Button {
            pick(move, steps: steps)
          } label: {
            Text(verbatim: move)
          }
          .buttonStyle(ChartsChoiceStyle())
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text(
          "Pick the next move", tableName: "ActivitiesCharts",
          comment: "Group of next moves on a balance"))
    }

    if let hint {
      LessonRichText(hint)
        .font(.subheadline)
        .foregroundStyle(.orange)
    }

    if isChecked {
      BalanceSteps(
        steps: steps.map { ($0.move, $0.equation) }, reached: steps.count, showsAll: true)
    }
  }

  private func pick(
    _ move: String, steps: [(move: String, equation: String, state: BalanceModel.State?)]
  ) {
    guard reached < steps.count else {
      return
    }

    guard move == steps[reached].move else {
      hint = fields.hints.first { $0.move == move }?.hint
      return
    }

    hint = nil
    reached += 1

    if reached == steps.count {
      let answer = steps.last?.state.flatMap(BalanceModel.isolatedValue)
      context.setAnswer(answer.map { .numeric($0) })
    }
  }
}

/// The written solution as a checklist: reached steps ticked with their equation, the next one
/// dimmed as a nudge; after the check every step shows.
private struct BalanceSteps: View {
  let steps: [(move: String, equation: String)]
  let reached: Int
  let showsAll: Bool

  var body: some View {
    let visible = showsAll ? steps : Array(steps.prefix(reached + 1))

    VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(visible.enumerated()), id: \.offset) { index, step in
        let isDone = showsAll || index < reached

        Label {
          isDone
            ? Text(
              "\(step.move): \(step.equation)", tableName: "ActivitiesCharts",
              comment: "A solved step of an equation, like Take 1 off both sides: 2x = 6")
            : Text(verbatim: step.move)
        } icon: {
          Image(systemName: isDone ? "checkmark.circle.fill" : "circle.dashed")
            .foregroundStyle(isDone ? Color.success : .secondary)
        }
        .font(.subheadline)
        .foregroundStyle(isDone ? .primary : .secondary)
      }
    }
  }
}
