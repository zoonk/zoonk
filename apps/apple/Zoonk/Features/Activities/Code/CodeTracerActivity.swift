import SwiftUI

extension ActivityRenderer {
  static let codeTracer = ActivityRenderer(
    template: "codeTracer",
    grade: ActivityExpectedAnswer.grader(CodeTracerFields.self) { .assignment($0.expectedPairs) }
  ) { context in
    if let fields = try? context.fields(as: CodeTracerFields.self) {
      CodeTracerCanvas(context: context, fields: fields)
    }
  }
}

struct CodeTracerFields: Decodable, Sendable {
  struct Value: Decodable, Sendable {
    let name: String
    let value: JSONValue
  }

  struct Step: Decodable, Sendable {
    let line: Int
    let values: [Value]
  }

  struct Option: Decodable, Sendable, Identifiable {
    let id: String
    let text: String
  }

  struct Pause: Decodable, Sendable {
    let options: [Option]
    let question: String
    let step: Int
    let variable: String
  }

  let code: String
  let language: CodeLanguage
  let pauses: [Pause]
  let trace: [Step]
  let watch: [String]

  /// Pause position to the option equal to the traced value, as core's `expected`.
  var expectedPairs: [String: String] {
    Dictionary(
      uniqueKeysWithValues: pauses.enumerated().map {
        (String($0.offset), rightOption($0.element)?.id ?? "")
      })
  }

  /// The option that reads the traced value: the trace marks the answer, not the options.
  func rightOption(_ pause: Pause) -> Option? {
    let traced = tracedText(pause)
    return pause.options.first { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) == traced }
  }

  func tracedText(_ pause: Pause) -> String? {
    guard trace.indices.contains(pause.step) else {
      return nil
    }

    return trace[pause.step].values.first { $0.name == pause.variable }.map { Self.text($0.value) }
  }

  /// A watched variable at a step: a step lists only the values it shows, so a variable keeps its
  /// last known value until a step changes it.
  func value(of name: String, at step: Int) -> String? {
    guard step >= 0 else {
      return nil
    }

    return trace.prefix(step + 1).flatMap(\.values).last { $0.name == name }.map {
      Self.text($0.value)
    }
  }

  /// A traced value as JavaScript's `String(value)` writes it, which is what core compares.
  static func text(_ value: JSONValue) -> String {
    switch value {
    case .string(let text): text
    case .bool(let flag): flag ? "true" : "false"
    case .number(let number):
      number.rounded() == number && abs(number) < 1e18 ? String(Int64(number)) : String(number)
    default: ""
    }
  }
}

/// Step through a program line by line and watch its variables change (main's
/// `CodeTracerActivity`). At each pause the learner predicts a value before stepping on to see it;
/// the predictions are the answer. After the check every pause shows the traced value next to the
/// prediction, and the run can still be replayed. Explored, the program steps freely.
private struct CodeTracerCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeTracerFields

  @State private var step: Int
  @State private var furthest: Int
  @State private var predictions: [String: String]

  init(context: ActivityCanvasContext, fields: CodeTracerFields) {
    self.context = context
    self.fields = fields
    // Before the first line when the learner must predict it.
    let start = fields.pauses.contains { $0.step == 0 } ? -1 : 0
    _step = State(initialValue: start)
    _furthest = State(initialValue: start)
    _predictions = State(initialValue: context.answer?.pairs ?? [:])
  }

  private var start: Int {
    fields.pauses.contains { $0.step == 0 } ? -1 : 0
  }

  private var lastStep: Int {
    fields.trace.count - 1
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var asksNothing: Bool {
    context.phase != .answering
  }

  /// The pause right after the current step, while the learner hasn't seen its value.
  private var upcoming: Int? {
    guard !asksNothing,
      let index = fields.pauses.firstIndex(where: { $0.step == step + 1 }),
      furthest < fields.pauses[index].step
    else {
      return nil
    }

    return index
  }

  private var isBlocked: Bool {
    !asksNothing
      && fields.pauses.indices.contains {
        fields.pauses[$0].step == step + 1 && predictions[String($0)] == nil
      }
  }

  private var position: Text {
    step < 0
      ? Text(
        "Before the first line", tableName: "ActivitiesCode",
        comment: "A code trace before any line ran")
      : Text(
        "Step \(step + 1) of \(lastStep + 1)", tableName: "ActivitiesCode",
        comment: "Where a code trace is")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      variables

      GroupBox {
        let lines = fields.code.components(separatedBy: "\n")
        let current =
          step >= 0 && fields.trace.indices.contains(step) ? fields.trace[step].line : nil

        VStack(alignment: .leading, spacing: 2) {
          ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
            CodeLine(
              number: index + 1, digits: String(lines.count).count,
              tone: current == index + 1 ? .current : .plain
            ) {
              Text(verbatim: line)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(current == index + 1 ? .isSelected : [])
          }
        }
      } label: {
        controls
      }

      if let upcoming {
        prediction(index: upcoming)
      } else if !isChecked {
        ActivityCaption(hint)
      }

      predictionLog
    }
  }

  private var variables: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .top, spacing: 4) {
        variableCells
      }

      VStack(alignment: .leading, spacing: 4) {
        variableCells
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "Variables", tableName: "ActivitiesCode",
        comment: "VoiceOver: a code trace's watched variables"))
  }

  /// Each watched variable at this step; a value that just changed shows what it was.
  private var variableCells: some View {
    ForEach(fields.watch, id: \.self) { name in
      let value = fields.value(of: name, at: step)
      let previous = step < 1 ? nil : fields.value(of: name, at: step - 1)
      let changed = previous != nil && value != previous

      VStack(alignment: .leading, spacing: 2) {
        Text(verbatim: name)
          .font(.caption.monospaced())
          .foregroundStyle(changed ? AnyShapeStyle(.orange) : AnyShapeStyle(.secondary))

        HStack(alignment: .firstTextBaseline, spacing: 4) {
          if changed, let previous {
            Text(
              "\(previous) →", tableName: "ActivitiesCode",
              comment: "A variable's value before it changed"
            )
            .font(.caption.monospaced())
            .foregroundStyle(.orange)
          }

          if let value {
            Text(verbatim: value)
              .font(.body.monospaced().weight(.semibold))
          } else {
            Text(
              "not set", tableName: "ActivitiesCode", comment: "A variable before a program sets it"
            )
            .font(.body)
            .foregroundStyle(.secondary)
          }
        }
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(changed ? Color.orange.opacity(0.15) : .clear, in: .rect(cornerRadius: 10))
      .accessibilityElement(children: .combine)
    }
  }

  private var controls: some View {
    HStack {
      position
        .font(.caption.weight(.medium))
        .monospacedDigit()
        .foregroundStyle(.secondary)

      Spacer()

      Button {
        goTo(step - 1)
      } label: {
        Label {
          Text(
            "Step back", tableName: "ActivitiesCode", comment: "Go back one step in a code trace")
        } icon: {
          Image(systemName: "backward.frame")
        }
      }
      .disabled(step <= start)

      Button {
        goTo(step + 1)
      } label: {
        Label {
          Text(
            "Step forward", tableName: "ActivitiesCode",
            comment: "Run the next line of a code trace")
        } icon: {
          Image(systemName: "forward.frame")
        }
      }
      .disabled(step >= lastStep || isBlocked)
    }
    .labelStyle(.iconOnly)
    .buttonStyle(.bordered)
  }

  private var hint: Text {
    if step < lastStep {
      Text(
        "Step forward to run the next line.", tableName: "ActivitiesCode",
        comment: "Under a code trace")
    } else if context.phase == .explore {
      Text(
        "That's the whole run.", tableName: "ActivitiesCode",
        comment: "At the end of an explored code trace")
    } else {
      Text(
        "That's the whole run. Check your predictions when you're ready.",
        tableName: "ActivitiesCode",
        comment: "At the end of a code trace, before the check")
    }
  }

  private func prediction(index: Int) -> some View {
    let pause = fields.pauses[index]
    let key = String(index)
    // Short values sit side by side; four make a 2 by 2 grid.
    let columns =
      pause.options.contains { $0.text.count > 8 } ? 1 : pause.options.count == 3 ? 3 : 2

    return VStack(alignment: .leading, spacing: 8) {
      LessonRichText(pause.question)
        .font(.body.weight(.medium))

      LazyVGrid(
        columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8
      ) {
        ForEach(Array(pause.options.enumerated()), id: \.element.id) { position, option in
          let isSelected = predictions[key] == option.id

          Button {
            predictions[key] = option.id
            let pairs = fields.pauses.indices.map(String.init)
            context.setAnswer(
              pairs.allSatisfy { predictions[$0] != nil } ? .assignment(predictions) : nil)
          } label: {
            Text(verbatim: option.text)
              .font(.body.monospaced())
          }
          .buttonStyle(
            ActivityTileStyle(mark: isSelected ? .selected : .plain, isCompact: columns > 1)
          )
          .modifier(ActivityNumberKey(index: position))
          .accessibilityAddTraits(isSelected ? .isSelected : [])
        }
      }

      ActivityCaption(
        predictions[key] == nil
          ? Text(
            "Predict first. Then step forward to see what happens.", tableName: "ActivitiesCode",
            comment: "Before a prediction in a code trace")
          : Text(
            "Step forward to see if you're right.", tableName: "ActivitiesCode",
            comment: "After a prediction in a code trace"))
    }
  }

  /// Predictions already revealed: what the learner said and what the run showed.
  @ViewBuilder
  private var predictionLog: some View {
    let revealed = fields.pauses.enumerated().filter { index, pause in
      predictions[String(index)] != nil && (isChecked || furthest >= pause.step)
    }

    if !revealed.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(revealed, id: \.offset) { index, pause in
          let guessId = predictions[String(index)]
          let guess = pause.options.first { $0.id == guessId }?.text ?? ""
          let isRight = guessId == fields.rightOption(pause)?.id

          Label {
            VStack(alignment: .leading, spacing: 2) {
              LessonRichText(pause.question)
                .foregroundStyle(.secondary)

              Group {
                if isRight {
                  Text(
                    "You said \(guess), and it was.", tableName: "ActivitiesCode",
                    comment: "A right prediction in a code trace")
                } else {
                  Text(
                    "You said \(guess); it was \(fields.tracedText(pause) ?? "").",
                    tableName: "ActivitiesCode",
                    comment: "A wrong prediction in a code trace, then the traced value")
                }
              }
              .fontWeight(.medium)
            }
          } icon: {
            Image(systemName: isRight ? "checkmark" : "xmark")
              .fontWeight(.semibold)
              .foregroundStyle(isRight ? Color.success : .destructive)
          }
          .font(.subheadline)
          .accessibilityElement(children: .combine)
        }
      }
    }
  }

  private func goTo(_ next: Int) {
    step = next
    furthest = max(furthest, next)
    let line = fields.trace.indices.contains(next) ? fields.trace[next].line : nil
    announceActivityChange(
      line.map {
        String(
          localized: "Step \(next + 1) of \(lastStep + 1). Line \($0) ran.",
          table: "ActivitiesCode",
          comment: "VoiceOver: where a code trace is after a step")
      }
        ?? String(
          localized: "Before the first line", table: "ActivitiesCode",
          comment: "A code trace before any line ran"))
  }
}
