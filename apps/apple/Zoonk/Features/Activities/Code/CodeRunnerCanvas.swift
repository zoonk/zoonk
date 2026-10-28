import SwiftUI

struct CodeRunnerCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeRunnerFields
  @State private var lines: [String]
  @State private var result: CodeProgramResult?
  @State private var runner = CodeProgramRunner()
  @State private var task: Task<Void, Never>?
  @State private var revision = 0

  init(context: ActivityCanvasContext, fields: CodeRunnerFields) {
    self.context = context
    self.fields = fields
    _lines = State(
      initialValue: (context.phase == .explore ? fields.solution : fields.starterCode).components(
        separatedBy: "\n"))
    if case .string(let output) = context.answer?.value["output"] {
      _result = State(initialValue: CodeProgramResult(output: output))
    }
  }

  private var locked: Bool { if case .checked = context.phase { true } else { false } }

  var body: some View {
    VStack(alignment: .leading) {
      Text(verbatim: fields.fileName ?? (fields.language == "python" ? "main.py" : "main.js"))
        .font(.caption).foregroundStyle(.secondary)
      ForEach(lines.indices, id: \.self) { index in
        HStack(alignment: .firstTextBaseline) {
          Text(verbatim: "\(index + 1)").foregroundStyle(.secondary)
          if fields.editableLines.contains(index + 1) && !locked {
            CodeTextEditor(
              text: $lines[index],
              label: String(
                localized: "Line \(index + 1), yours to edit", table: "ActivitiesCode",
                comment: "Editable code line")
            )
            .font(.body.monospaced())
            .autocorrectionDisabled().textInputAutocapitalization(.never)
            .accessibilityLabel(
              Text(
                "Line \(index + 1), yours to edit", tableName: "ActivitiesCode",
                comment: "Editable code line")
            )
            .frame(maxWidth: .infinity, alignment: .leading)
          } else {
            Text(verbatim: lines[index]).font(.body.monospaced())
          }
        }
      }
      if !locked {
        Button {
          let current = revision
          task = Task {
            let run = await runner.run(
              code: lines.joined(separator: "\n"), language: fields.language)
            guard !Task.isCancelled, current == revision else { return }
            result = run
            task = nil
            context.setAnswer(
              run.stop == .unavailable || run.stop == .cancelled
                ? nil
                : ActivityAnswer(
                  value: .object(["kind": .string("output"), "output": .string(run.output)])))
          }
        } label: {
          Text("Run", tableName: "ActivitiesCode", comment: "Run the learner's program")
        }
        .buttonStyle(.mainAction).disabled(task != nil)
        Button {
          lines = (context.phase == .explore ? fields.solution : fields.starterCode).components(
            separatedBy: "\n")
        } label: {
          Text("Reset", tableName: "ActivitiesCode", comment: "Restore the starter code")
        }
      }
      if task != nil {
        ProgressView {
          Text("Running…", tableName: "ActivitiesCode", comment: "A program or query is running")
        }
      }
      if context.phase != .explore {
        Text(
          "Expected output", tableName: "ActivitiesCode", comment: "Output the program should print"
        ).font(.headline)
        Text(verbatim: fields.expectedOutput).font(.body.monospaced())
      }
      if let result {
        Text("Output", tableName: "ActivitiesCode", comment: "Program standard output").font(
          .headline)
        Text(verbatim: result.output).font(.body.monospaced()).textSelection(.enabled)
        if !result.errorOutput.isEmpty {
          Text(verbatim: result.errorOutput).font(.body.monospaced()).foregroundStyle(.secondary)
        }
        if let message = result.message {
          Text(verbatim: message).font(.body.monospaced()).foregroundStyle(.red)
        }
        if result.stop == .timeout {
          Text(
            "The program took too long and was stopped.", tableName: "ActivitiesCode",
            comment: "Program execution timeout")
        }
        if result.stop == .unavailable {
          Text(
            "The runtime didn't load. Check your connection and try again.",
            tableName: "ActivitiesCode", comment: "Runtime loading failed")
        }
        if result.stop == .tooMuchOutput {
          Text(
            "The program printed too much and was stopped.", tableName: "ActivitiesCode",
            comment: "Output limit exceeded")
        }
        if let mistake = fields.mistakes.first(where: {
          CodeActivityText.normalize($0.output) == CodeActivityText.normalize(result.output)
        }), context.phase != .explore {
          Text(verbatim: mistake.feedback)
        }
      }
      if locked {
        Text(
          "A program that works", tableName: "ActivitiesCode",
          comment: "Reference solution after grading"
        ).font(.headline)
        Text(verbatim: fields.solution).font(.body.monospaced())
      }
    }
    .onChange(of: lines) {
      revision += 1
      task?.cancel()
      runner.cancel()
      task = nil
      result = nil
      context.setAnswer(nil)
    }
    .onDisappear {
      revision += 1
      task?.cancel()
      runner.cancel()
      task = nil
    }
  }
}
