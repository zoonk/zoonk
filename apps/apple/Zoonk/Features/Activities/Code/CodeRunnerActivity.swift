import SwiftUI

extension ActivityRenderer {
  static let codeRunner = ActivityRenderer(
    template: "codeRunner",
    grade: CodeRunnerFields.grade
  ) { context in
    if let fields = try? context.fields(as: CodeRunnerFields.self) {
      CodeRunnerCanvas(context: context, fields: fields)
    }
  }
}

struct CodeRunnerFields: Decodable, Sendable {
  struct Mistake: Decodable, Sendable {
    let feedback: String
    let output: String
  }

  let editableLines: [Int]
  let expectedOutput: String
  let fileName: String?
  let language: CodeLanguage
  let mistakes: [Mistake]
  let solution: String
  let starterCode: String

  static func grade(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard let fields = try? content.fields(as: Self.self), let output = answer.output else {
      return false
    }

    return sameOutput(output, fields.expectedOutput)
  }

  /// Output compares the way core grades it: trailing spaces and blank lines don't count.
  static func sameOutput(_ first: String, _ second: String) -> Bool {
    normalize(first) == normalize(second)
  }

  /// Core's `normalizeProgramOutput`.
  static func normalize(_ output: String) -> String {
    output.replacingOccurrences(of: "(?m)[\\t ]+$", with: "", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

extension ActivityAnswer {
  static func output(_ output: String) -> ActivityAnswer {
    ActivityAnswer(value: .object(["kind": .string("output"), "output": .string(output)]))
  }

  var output: String? {
    guard kind == "output", case .string(let output) = value["output"] else {
      return nil
    }

    return output
  }
}

/// The output of the last run is the answer, so editing after a run waits for the next run.
private struct CodeRunnerCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeRunnerFields

  @State private var runner: CodeProgramRunner
  @State private var edits: [Int: String] = [:]
  @State private var run: CodeProgramRun?
  /// The run in progress; a result for any other run is dropped.
  @State private var activeRun: UUID?
  @State private var revision = 0
  @State private var isStale = false
  @State private var runtime: CodeRuntimeStatus
  @State private var runtimeAttempt = 0

  init(context: ActivityCanvasContext, fields: CodeRunnerFields) {
    self.context = context
    self.fields = fields
    _runner = State(initialValue: CodeProgramRunner(language: fields.language))
    _run = State(
      initialValue: context.answer?.output.map { CodeProgramRun(stop: .done, output: $0) })
    // JavaScript needs no download, so there's nothing to wait for.
    _runtime = State(initialValue: fields.language == .python ? .loading : .ready)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var isExploring: Bool {
    context.phase == .explore
  }

  private var lines: [String] {
    (isExploring ? fields.solution : fields.starterCode).components(separatedBy: "\n").enumerated()
      .map { edits[$0.offset + 1] ?? $0.element }
  }

  private var matches: Bool {
    run.map { CodeRunnerFields.sameOutput($0.output, fields.expectedOutput) } ?? false
  }

  private var mistake: String? {
    guard let run, !matches, !isExploring else {
      return nil
    }

    return fields.mistakes.first { CodeRunnerFields.sameOutput($0.output, run.output) }?.feedback
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      GroupBox {
        program
      } label: {
        header
      }

      CodeRunnerOutput(
        run: run, expectedOutput: isExploring ? nil : fields.expectedOutput,
        language: fields.language, isStale: isStale, matches: matches, mistake: mistake)

      if !isChecked {
        CodeRunBar(
          runtimeName: fields.language.runtimeName, status: runtime, hasRun: run != nil,
          isRunning: activeRun != nil, run: { startRun() }, retry: { runtimeAttempt += 1 },
          reset: edits.isEmpty ? nil : { reset() })
      }
    }
    .task(id: runtimeAttempt) {
      guard fields.language == .python else {
        return
      }

      runtime = .loading
      runtime = await runner.warmUp() ? .ready : .failed
    }
    .onDisappear {
      activeRun = nil
      runner.close()
    }
  }

  private var header: some View {
    ViewThatFits(in: .horizontal) {
      HStack {
        fileName
        Spacer()
        yourLines
      }

      VStack(alignment: .leading, spacing: 4) {
        fileName
        yourLines
      }
    }
    .font(.caption)
    .foregroundStyle(.secondary)
  }

  private var fileName: some View {
    Text(verbatim: fields.fileName ?? fields.language.defaultFileName)
      .monospaced()
  }

  @ViewBuilder
  private var yourLines: some View {
    if !isExploring {
      let lines = fields.editableLines.map(String.init).formatted(.list(type: .and))

      Label {
        if fields.editableLines.count == 1 {
          Text(
            "Line \(lines) is yours", tableName: "ActivitiesCode",
            comment: "The one line of a program the learner edits")
        } else {
          Text(
            "Lines \(lines) are yours", tableName: "ActivitiesCode",
            comment: "The lines of a program the learner edits, like “2 and 3”")
        }
      } icon: {
        Image(systemName: "pencil")
      }
    }
  }

  private var program: some View {
    let digits = String(lines.count).count
    let errorLine = isStale ? nil : run?.errorLine
    let colored = CodeHighlight.lines(
      of: lines.joined(separator: "\n"), language: fields.language.highlight)

    return VStack(alignment: .leading, spacing: 2) {
      ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
        let number = index + 1

        CodeLine(number: number, digits: digits, tone: errorLine == number ? .error : .plain) {
          if fields.editableLines.contains(number) && !isChecked {
            TextField(
              text: Binding(get: { line }, set: { edit(number, $0) }),
              prompt: nil
            ) {
              Text(
                "Line \(number), yours to edit", tableName: "ActivitiesCode",
                comment: "VoiceOver: a line of a program the learner edits")
            }
            .textFieldStyle(.roundedBorder)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.asciiCapable)
            .submitLabel(.go)
            .onSubmit(startRun)
          } else {
            Text(colored.indices.contains(index) ? colored[index] : AttributedString(line))
          }
        }
      }
    }
  }

  private func edit(_ number: Int, _ value: String) {
    edits[number] = value
    changed()
  }

  private func reset() {
    edits = [:]
    changed()
  }

  /// A run from before an edit still shows, dimmed, but isn't this code's answer.
  private func changed() {
    revision += 1
    isStale = true
    context.setAnswer(nil)
  }

  private func startRun() {
    guard !isChecked, activeRun == nil else {
      return
    }

    let id = UUID()
    let started = revision
    let code = lines.joined(separator: "\n")
    activeRun = id

    Task {
      let result = await runner.run(code)

      guard activeRun == id else {
        return
      }

      activeRun = nil
      run = result
      isStale = revision != started
      context.setAnswer(isStale || result.stop == .unavailable ? nil : .output(result.output))
    }
  }
}

/// The expected output is part of the task, so it shows from the start.
private struct CodeRunnerOutput: View {
  let run: CodeProgramRun?
  /// Nil when there's no output to reach, as when the program is explored.
  let expectedOutput: String?
  let language: CodeLanguage
  let isStale: Bool
  let matches: Bool
  let mistake: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 0) {
        cell {
          if expectedOutput == nil {
            Text("Output", tableName: "ActivitiesCode", comment: "What an explored program printed")
          } else {
            Text(
              "Your output", tableName: "ActivitiesCode",
              comment: "What the learner's program printed")
          }
        } content: {
          printed
        }
        .opacity(isStale && run != nil ? 0.6 : 1)

        if let expectedOutput {
          Divider()

          cell {
            Text(
              "Expected", tableName: "ActivitiesCode", comment: "The output a program should print")
          } content: {
            outputText(expectedOutput)
          }
        }
      }
      .fixedSize(horizontal: false, vertical: true)
      .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))

      if let run {
        if isStale {
          ActivityCaption(
            Text(
              "You changed the code. Run it again to see the new output.",
              tableName: "ActivitiesCode",
              comment: "Under the output of a program the learner edited since running it"))
        } else {
          stopNotice(run)

          if !run.errorOutput.isEmpty {
            ScrollView(.horizontal) {
              Text(verbatim: run.errorOutput.trimmingCharacters(in: .newlines))
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
            }
          }

          if let mistake {
            Label {
              VStack(alignment: .leading, spacing: 2) {
                Text(
                  "Not quite", tableName: "ActivitiesCode",
                  comment:
                    "Gentle verdict after a wrong answer, above the feedback on its likely mistake"
                )
                .fontWeight(.semibold)
                .foregroundStyle(.destructive)
                LessonRichText(mistake)
              }
            } icon: {
              Image(systemName: "xmark.circle")
                .foregroundStyle(.destructive)
            }
            .font(.subheadline)
          }
        }
      }
    }
  }

  private func cell(
    @ViewBuilder label: () -> some View, @ViewBuilder content: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      label()
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)

      ScrollView(.horizontal) {
        content()
      }
      .scrollBounceBehavior(.basedOnSize)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }

  @ViewBuilder
  private var printed: some View {
    if let run {
      if run.output.isEmpty {
        Text(
          "Nothing printed", tableName: "ActivitiesCode", comment: "A program ran without printing"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      } else if expectedOutput != nil && !isStale {
        outputText(run.output)
          .foregroundStyle(matches ? Color.success : .destructive)
          .accessibilityValue(
            matches
              ? Text(
                "Matches the expected output", tableName: "ActivitiesCode",
                comment: "VoiceOver: the program printed what it should")
              : Text(
                "Doesn't match the expected output", tableName: "ActivitiesCode",
                comment: "VoiceOver: the program printed something else"))
      } else {
        outputText(run.output)
      }
    } else {
      Text(
        "Run the code to see it", tableName: "ActivitiesCode",
        comment: "Before a program's first run"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }

  private func outputText(_ text: String) -> some View {
    Text(verbatim: text.replacingOccurrences(of: "\\s+$", with: "", options: .regularExpression))
      .font(.title3.monospaced().weight(.semibold))
      .textSelection(.enabled)
  }

  @ViewBuilder
  private func stopNotice(_ run: CodeProgramRun) -> some View {
    if let message = stopMessage(run) {
      Label {
        message
      } icon: {
        Image(systemName: "xmark.circle")
      }
      .font(.subheadline.monospaced())
      .foregroundStyle(.destructive)
    }
  }

  private func stopMessage(_ run: CodeProgramRun) -> Text? {
    switch run.stop {
    case .error:
      guard let error = run.error else {
        return nil
      }

      guard let line = run.errorLine else {
        return Text(verbatim: error)
      }

      return Text(
        "Line \(line): \(error)", tableName: "ActivitiesCode",
        comment: "A program's error and the line it happened on")
    case .timeout:
      return Text(
        "Stopped after \(language.timeLimitSeconds) seconds. Is there a loop that never ends?",
        tableName: "ActivitiesCode", comment: "A program ran out of time")
    case .tooMuchOutput:
      return Text(
        "Stopped because it printed too much. Is there a loop that never ends?",
        tableName: "ActivitiesCode", comment: "A program printed past the output limit")
    case .done, .unavailable:
      return nil
    }
  }
}
