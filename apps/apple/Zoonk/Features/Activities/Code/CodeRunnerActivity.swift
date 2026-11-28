import SwiftUI

extension ActivityRenderer {
  static let codeRunner = ActivityRenderer(
    template: "codeRunner",
    grade: CodeRunnerFields.grade
  ) { context, fields in
    CodeRunnerCanvas(context: context, fields: fields)
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
  /// A run on our servers names its `runID`, so the server grades the output it measured.
  static func output(_ output: String, runID: String? = nil) -> ActivityAnswer {
    var answer: [String: JSONValue] = ["kind": .string("output"), "output": .string(output)]
    answer["runId"] = runID.map(JSONValue.string)
    return ActivityAnswer(value: .object(answer))
  }

  var output: String? {
    guard kind == "output", case .string(let output) = value["output"] else {
      return nil
    }

    return output
  }
}

/// Why the last Run on our servers brought no output.
private enum CodeRunIssue: Equatable {
  case offline, unavailable
  case refused(HelpLimit)
}

/// The output of the last run is the answer, so editing after a run waits for the next run.
private struct CodeRunnerCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeRunnerFields

  @Environment(\.codeRuns) private var codeRuns
  /// Nil for a language that runs on our servers.
  @State private var runner: CodeProgramRunner?
  @ActivityState("edits") private var edits: [Int: String] = [:]
  @ActivityState private var run: CodeProgramRun?
  /// The run in progress; a result for any other run is dropped.
  @State private var activeRun: UUID?
  @State private var runPhase = CodeRunPhase.starting
  /// A quick run ends before its steps would flash under Run.
  @State private var showsPhase = false
  @State private var issue: CodeRunIssue?
  /// A run that broke off is sent again under its request, so the server answers it once.
  @State private var retryRequest: (code: String, id: String)?
  @State private var revision = 0
  @ActivityState("isStale") private var isStale = false
  @State private var runtime: CodeRuntimeStatus
  @State private var runtimeAttempt = 0
  @FocusState private var editingLine: Int?

  init(context: ActivityCanvasContext, fields: CodeRunnerFields) {
    self.context = context
    self.fields = fields
    _runner = State(
      initialValue: fields.language.runsOnDevice
        ? CodeProgramRunner(language: fields.language) : nil
    )
    _run = ActivityState(
      wrappedValue: context.answer?.output.map { CodeProgramRun(stop: .done, output: $0) }, "run")
    // JavaScript needs no download, so there's nothing to wait for.
    _runtime = State(initialValue: fields.language == .python ? .loading : .ready)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var isExploring: Bool {
    context.phase == .explore
  }

  /// A right answer opened again keeps only its output, so the program that prints it is the
  /// solution, as main's is.
  private var lines: [String] {
    let reopenedRight = isChecked && matches && edits.isEmpty

    return (isExploring || reopenedRight ? fields.solution : fields.starterCode)
      .components(separatedBy: "\n").enumerated()
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

  private var refusal: HelpLimit? {
    if case .refused(let limit) = issue { limit } else { nil }
  }

  private var runFailure: LocalizedStringResource? {
    switch issue {
    case .offline:
      LocalizedStringResource(
        "Running \(fields.language.runtimeName) code needs a connection. Check yours and try again.",
        table: "ActivitiesCode")
    case .unavailable:
      LocalizedStringResource("Your code didn't run. Try again.", table: "ActivitiesCode")
    case .refused, nil:
      nil
    }
  }

  private var phaseLine: String? {
    guard showsPhase, activeRun != nil else {
      return nil
    }

    return switch runPhase {
    case .starting:
      String(localized: "Getting \(fields.language.runtimeName) ready…", table: "ActivitiesCode")
    case .compiling:
      String(localized: "Compiling your code…", table: "ActivitiesCode")
    case .running:
      String(localized: "Running your code…", table: "ActivitiesCode")
    }
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

      if !isChecked, let refusal {
        LimitNotice(limit: refusal, kind: .runs)
      }

      if !isChecked {
        CodeRunBar(
          runtimeName: fields.language.runtimeName, status: runFailure == nil ? runtime : .failed,
          hasRun: run != nil, isExploring: isExploring, isRunning: activeRun != nil,
          run: { startRun() },
          retry: retry,
          reset: edits.isEmpty ? nil : { reset() }, failure: runFailure, progress: phaseLine)
      }
    }
    .announcesStatus(refusal?.words(.runs).said)
    .task(id: runtimeAttempt) {
      guard fields.language == .python else {
        return
      }

      runtime = .loading
      runtime = await runner?.warmUp() ?? false ? .ready : .failed
    }
    .task(id: activeRun) {
      showsPhase = false

      guard activeRun != nil, (try? await Task.sleep(for: .milliseconds(400))) != nil else {
        return
      }

      showsPhase = true
    }
    // A run still going at Check ends unseen, so the answer keeps the output it was graded on.
    .onChange(of: isChecked) {
      activeRun = nil
    }
    .onDisappear {
      activeRun = nil
      runner?.close()
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
    .typeStyle(.meta)
    .foregroundStyle(.mutedForeground)
  }

  private var fileName: some View {
    Text(verbatim: fields.fileName ?? fields.language.defaultFileName)
      .typeStyle(.data)
  }

  /// Main's "Edit line 2": gone once checked, keeping its room so the header doesn't move.
  @ViewBuilder
  private var yourLines: some View {
    if !isExploring {
      let lines = fields.editableLines.map(String.init).formatted(.list(type: .and))

      Group {
        if fields.editableLines.count == 1 {
          Text("Edit line \(lines)", tableName: "ActivitiesCode")
        } else {
          Text("Edit lines \(lines)", tableName: "ActivitiesCode")
        }
      }
      .opacity(isChecked ? 0 : 1)
      .accessibilityHidden(isChecked)
    }
  }

  private var program: some View {
    let digits = String(lines.count).count
    let errorLine = isStale ? nil : run?.errorLine
    let colored = CodeHighlight.lines(
      of: lines.joined(separator: "\n"), language: fields.language.rawValue)

    return CodeFrame {
      ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
        let number = index + 1

        let isYours = fields.editableLines.contains(number)
        let isEditable = isYours && !isChecked

        CodeLine(
          number: number, digits: digits,
          tone: errorLine == number ? .error : isEditable ? .editable : .plain,
          spoken: isEditable ? nil : SpokenCode.line(line, number: number)
        ) {
          if isYours {
            // Wraps as main's does, and as the lines around it do; Return runs the program.
            // Checked, it stays a field that can't change: as text, a line is a fraction shorter,
            // and everything under it would move up.
            MultilineTextField(
              text: Binding(get: { line }, set: { edit(number, $0) }),
              label: Text(
                "Line \(number), yours to edit", tableName: "ActivitiesCode",
                comment: "VoiceOver: a line of a program the learner edits"),
              onSubmit: startRun
            )
            .textFieldStyle(.plain)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.asciiCapable)
            .submitLabel(.go)
            .focused($editingLine, equals: number)
            .codeColors(line, language: fields.language.rawValue)
            .disabled(isChecked)
          } else {
            CodeText(tokens: colored.indices.contains(index) ? colored[index] : [])
          }
        }
      }
    }
  }

  /// A paste keeps to its line, as main's does. A field that stops editing writes its text back
  /// unchanged, which mustn't mark the run it just started as stale.
  private func edit(_ number: Int, _ value: String) {
    let line = value.filter { !$0.isNewline }

    guard line != lines[number - 1] else {
      return
    }

    edits[number] = line
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
    runPhase = .starting
    issue = nil
    // As on main, where Run takes focus from the code, the keyboard goes so the output shows.
    editingLine = nil

    Task {
      let outcome = await outcome(of: code, run: id)

      guard activeRun == id else {
        return
      }

      activeRun = nil

      switch outcome {
      case .finished(let result):
        show(result, startedAt: started)
      case .refused(let limit):
        issue = .refused(limit)
      case .offline:
        issue = .offline
      case .unavailable:
        issue = .unavailable
      case nil:
        break
      }
    }
  }

  private func outcome(of code: String, run id: UUID) async -> CodeRunOutcome? {
    if let runner {
      return .finished(await runner.run(code))
    }

    let requestID =
      retryRequest.flatMap { $0.code == code ? $0.id : nil } ?? UUID().uuidString.lowercased()
    let outcome = await codeRuns.run(
      CodeRuns.Request(
        code: code, language: fields.language, id: requestID,
        phase: { phase in
          if activeRun == id {
            runPhase = phase
          }
        },
        keepWaiting: { activeRun == id }))

    retryRequest = outcome == .offline ? (code, requestID) : nil
    return outcome
  }

  /// Python downloads again; a language that runs on our servers runs again.
  private func retry() {
    if runner == nil {
      startRun()
    } else {
      runtimeAttempt += 1
    }
  }

  private func show(_ result: CodeProgramRun, startedAt started: Int) {
    run = result
    isStale = revision != started
    // A worker a timeout ended reloads Pyodide on the next run, which can fail offline.
    if result.stop == .unavailable, fields.language == .python {
      runtime = .failed
    }
    context.setAnswer(
      isStale || result.stop == .unavailable
        ? nil : .output(result.output, runID: result.runID))
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
          Text("Output", tableName: "ActivitiesCode")
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
      .activityBox()

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
                .typeStyle(.data)
                .foregroundStyle(.mutedForeground)
            }
          }

          if let mistake {
            Label {
              RichInlineText(Self.notQuite + LessonRichText.typeset(mistake))
            } icon: {
              Image(systemName: "xmark.circle")
                .foregroundStyle(.destructive)
            }
            .typeStyle(.body)
          }
        }
      }
    }
    .announcesStatus(isStale ? nil : run.flatMap(stopMessage))
  }

  private func cell(
    @ViewBuilder label: () -> some View, @ViewBuilder content: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      label()
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)

      HorizontalScroll {
        content()
      }
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
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      } else if expectedOutput != nil && !isStale {
        outputText(run.output)
          .foregroundStyle(matches ? Color.successText : .destructiveText)
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
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }

  private func outputText(_ text: String) -> some View {
    Text(verbatim: text.replacingOccurrences(of: "\\s+$", with: "", options: .regularExpression))
      .typeStyle(.programOutput)
      .textSelection(.enabled)
  }

  /// Main's `NotQuiteLead`: the feedback's own line starts with it.
  private static var notQuite: RichInline {
    var lead = AttributedString(
      localized: LocalizedStringResource(
        "Not quite:", table: "ActivitiesCode",
        comment: "Before the feedback on the likely mistake behind a program's wrong output"))
    lead.inlinePresentationIntent = .stronglyEmphasized
    lead.foregroundColor = .destructiveText
    return RichInline(text: lead + AttributedString(" "))
  }

  @ViewBuilder
  private func stopNotice(_ run: CodeProgramRun) -> some View {
    if let message = stopMessage(run) {
      Label {
        Text(message)
      } icon: {
        Image(systemName: "xmark.circle")
      }
      .typeStyle(.body.monospaced())
      .foregroundStyle(.destructiveText)
    }
  }

  private func stopMessage(_ run: CodeProgramRun) -> String? {
    switch run.stop {
    case .error:
      guard let error = run.error else {
        return nil
      }

      guard let line = run.errorLine else {
        return error
      }

      return String(
        localized: "Line \(line): \(error)", table: "ActivitiesCode",
        locale: .appLanguage, comment: "A program's error and the line it happened on")
    // Our servers stop a program's build and its run at different limits, so a time can't be named.
    case .timeout where !language.runsOnDevice:
      return String(
        localized: "Stopped because it took too long. Is there a loop that never ends?",
        table: "ActivitiesCode")
    case .timeout:
      return String(
        localized:
          "Stopped after \(language.timeLimitSeconds) seconds. Is there a loop that never ends?",
        table: "ActivitiesCode", locale: .appLanguage, comment: "A program ran out of time")
    case .tooMuchOutput:
      return String(
        localized: "Stopped because it printed too much. Is there a loop that never ends?",
        table: "ActivitiesCode", comment: "A program printed past the output limit")
    case .done, .unavailable:
      return nil
    }
  }
}
