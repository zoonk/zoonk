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
  /// Why the last run didn't happen, in place of the runtime's "didn't load".
  var failure: LocalizedStringResource?
  /// What the run is doing, under Run.
  var progress: String?

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
          message: failure
            ?? LocalizedStringResource(
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
                Text("Start over", tableName: "ActivitiesCode")
              } icon: {
                Image(systemName: "arrow.counterclockwise")
              }
            }
            .buttonStyle(.outline)
            .disabled(isRunning)
          }

          runButton
        }
        .controlSize(.large)

        if let line = loadingLine ?? progress {
          ActivityCaption(Text(line))
        }
      }
    }
    // One stack whatever the status, so the line a retry brings back is read out.
    .announcesStatus(loadingLine ?? progress)
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

/// Main's `CodeSnippet`: `before` goes in front of the selection and `after` behind it. `name` is
/// what VoiceOver says for a symbol, as "Any digit" for `\d`.
struct SnippetKey: Identifiable {
  let label: String
  let before: String
  var after = ""
  var name: String?

  var id: String { label }

  /// Main's `insertAtCursor`: wraps the selection, or types at the caret (at the end without one),
  /// and puts the caret after what it wrapped.
  func insert(into text: inout String, selection: inout TextSelection?) {
    var range = text.endIndex..<text.endIndex

    if case .selection(let selected) = selection?.indices, selected.upperBound <= text.endIndex {
      range = selected
    }

    let selected = String(text[range])
    let caret =
      text.distance(from: text.startIndex, to: range.lowerBound) + before.count
      + selected.count
    text.replaceSubrange(range, with: before + selected + after)
    selection = TextSelection(insertionPoint: text.index(text.startIndex, offsetBy: caret))
  }
}

/// Main's `ActivitySnippetBar`: keys under a code field for what a phone keyboard hides, such as
/// a regex's symbols or a table's columns. A checked answer keeps them, disabled.
struct CodeSnippetBar: View {
  let snippets: [SnippetKey]
  let label: Text
  var isEnabled = true
  let insert: (SnippetKey) -> Void

  var body: some View {
    HorizontalScroll {
      HStack(spacing: 8) {
        ForEach(snippets) { snippet in
          Button {
            insert(snippet)
          } label: {
            Text(verbatim: snippet.label)
              .typeStyle(.body.monospaced())
          }
          .buttonStyle(SnippetKeyStyle())
          .accessibilityLabel(
            Text(
              verbatim: snippet.name.flatMap {
                $0 == snippet.label ? nil : "\(snippet.label), \($0)"
              }
                ?? snippet.label))
        }
      }
    }
    .disabled(!isEnabled)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(label)
  }
}

/// Main's snippet key: a `secondary` fill, as tall as a touch target.
private struct SnippetKeyStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(Color(.foreground))
      .padding(.horizontal, 12)
      .frame(minWidth: 44, minHeight: 44)
      .background(
        Color(.secondary).opacity(configuration.isPressed ? 0.8 : 1),
        in: .rect(cornerRadius: Radius.lg, style: .continuous)
      )
      .contentShape(.rect)
      .opacity(isEnabled ? 1 : 0.5)
  }
}
