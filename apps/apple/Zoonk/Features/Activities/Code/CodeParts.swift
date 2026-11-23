import SwiftUI

/// Whether a code activity's runtime is ready: Pyodide downloads before the first Python run.
enum CodeRuntimeStatus {
  case loading, ready, failed
}

/// Run stays secondary, so the screen's Check stands out. While the runtime loads, Run still works:
/// the run starts as soon as it's ready.
struct CodeRunBar: View {
  let runtimeName: String
  let status: CodeRuntimeStatus
  let hasRun: Bool
  /// Exploring, a run can be repeated as it is ("Run again"); a task's run follows an edit.
  let isExploring: Bool
  let isRunning: Bool
  var canRun = true
  let run: () -> Void
  let retry: () -> Void
  /// Shown only once there's something to undo.
  var reset: (() -> Void)?

  private var loadingLine: String? {
    guard status == .loading else {
      return nil
    }

    return String(
      localized: "Getting \(runtimeName) ready. This takes a few seconds the first time.",
      table: "ActivitiesCode", comment: "A code runtime (Python) is downloading")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: status == .failed ? 8 : 6) {
      if status == .failed {
        FailureLine(
          message: LocalizedStringResource(
            "\(runtimeName) didn't load. Check your connection and try again.",
            table: "ActivitiesCode", comment: "A code runtime (Python) failed to download")
        )
        .typeStyle(.body)

        Button(action: retry) {
          Label {
            Text("Try again", tableName: "ActivitiesCode", comment: "Load a code runtime again")
          } icon: {
            Image(systemName: "arrow.counterclockwise")
          }
        }
        .buttonStyle(.outline)
      } else {
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
            .buttonStyle(.outline)
            .disabled(isRunning)
          }

          runButton
        }
        .controlSize(.large)

        if let loadingLine {
          ActivityCaption(Text(loadingLine))
        }
      }
    }
    // One stack whatever the status, so the line a retry brings back is read out.
    .announcesStatus(loadingLine)
  }

  private var runButton: some View {
    BusyButton(isBusy: isRunning, icon: .play, action: run) {
      if isExploring && hasRun {
        Text("Run again", tableName: "ActivitiesCode", comment: "Run a program or query again")
      } else {
        Text("Run", tableName: "ActivitiesCode", comment: "Run a program or query")
      }
    }
    .buttonStyle(.outline)
    .disabled(!canRun)
    .keyboardShortcut(.return, modifiers: .command)
  }
}
