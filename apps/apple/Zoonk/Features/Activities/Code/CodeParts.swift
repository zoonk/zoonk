import SwiftUI

/// Long lines wrap under their own text, so the numbers stay in one column.
struct CodeLine<Content: View>: View {
  enum Tone {
    case plain, current, error
  }

  let number: Int
  /// How many digits the program's last line number has, so every number takes the same width.
  let digits: Int
  var tone: Tone = .plain
  @ViewBuilder let content: Content

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Text(
        verbatim: String(repeating: " ", count: max(0, digits - String(number).count)) + "\(number)"
      )
      .foregroundStyle(.tertiary)

      content
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .font(.subheadline.monospaced())
    .padding(.horizontal, 6)
    .padding(.vertical, 3)
    .background(background, in: .rect(cornerRadius: 6))
    .overlay(alignment: .leading) {
      if tone == .current {
        Rectangle().fill(.orange).frame(width: 3)
      }
    }
  }

  private var background: Color {
    switch tone {
    case .plain: .clear
    case .current: .orange.opacity(0.15)
    case .error: Color.destructive.opacity(0.12)
    }
  }
}

/// Whether a code activity's runtime is ready: Pyodide downloads before the first Python run.
enum CodeRuntimeStatus {
  case loading, ready, failed
}

/// Run is the main action until the first run, then steps back so the screen's Check stands out.
/// While the runtime loads, Run still works: the run starts as soon as it's ready.
struct CodeRunBar: View {
  let runtimeName: String
  let status: CodeRuntimeStatus
  let hasRun: Bool
  let isRunning: Bool
  var canRun = true
  let run: () -> Void
  let retry: () -> Void
  /// Shown only once there's something to undo.
  var reset: (() -> Void)?

  var body: some View {
    if status == .failed {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "\(runtimeName) didn't load. Check your connection and try again.",
          tableName: "ActivitiesCode", comment: "A code runtime (Python) failed to download"
        )
        .font(.subheadline)
        .foregroundStyle(.destructive)

        Button(action: retry) {
          Label {
            Text("Try again", tableName: "ActivitiesCode", comment: "Load a code runtime again")
          } icon: {
            Image(systemName: "arrow.counterclockwise")
          }
        }
        .buttonStyle(.bordered)
      }
    } else {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 8) {
          if let reset {
            Button(action: reset) {
              Label {
                Text(
                  "Start over with the original code", tableName: "ActivitiesCode",
                  comment: "Undo the learner's edits to a program")
              } icon: {
                Image(systemName: "arrow.counterclockwise")
              }
              .labelStyle(.iconOnly)
            }
            .buttonStyle(.bordered)
            .disabled(isRunning)
          }

          if hasRun {
            runButton.buttonStyle(.bordered)
          } else {
            runButton.buttonStyle(.mainAction)
          }
        }
        .controlSize(.large)

        if status == .loading {
          ActivityCaption(
            Text(
              "Getting \(runtimeName) ready. This takes a few seconds the first time.",
              tableName: "ActivitiesCode", comment: "A code runtime (Python) is downloading"))
        }
      }
    }
  }

  private var runButton: some View {
    Button(action: run) {
      Group {
        if isRunning {
          Label {
            Text("Running", tableName: "ActivitiesCode", comment: "A program or query is running")
          } icon: {
            ProgressView()
          }
        } else {
          Label {
            if hasRun {
              Text(
                "Run again", tableName: "ActivitiesCode", comment: "Run a program or query again")
            } else {
              Text("Run", tableName: "ActivitiesCode", comment: "Run a program or query")
            }
          } icon: {
            Image(systemName: "play.fill")
          }
        }
      }
      .frame(maxWidth: .infinity)
    }
    .disabled(isRunning || !canRun)
    .keyboardShortcut(.return, modifiers: .command)
  }
}
