import SwiftUI

/// A button whose action is running. From the tap a spinner takes its icon's place, or a list row's
/// end, or covers its label when it has neither; the label stays, so the button never changes size
/// and VoiceOver still reads it. It keeps its look and its focus, and ignores taps until the work
/// ends, so it isn't `disabled`: that would gray it and take it out of keyboard focus. A row whose
/// mark or time shows the spinner places it itself with `coveredBySpinner`.
struct BusyButton<Title: View>: View {
  let isBusy: Bool
  var role: ButtonRole?
  var icon: ActionIcon?
  /// A list row's button, whose words keep the whole row.
  var isRow = false
  let action: () -> Void
  @ViewBuilder let label: Title

  var body: some View {
    Button(role: role) {
      if !isBusy {
        action()
      }
    } label: {
      if let icon, icon.trails {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          label
          image(icon)
        }
      } else if let icon {
        Label {
          label
        } icon: {
          image(icon)
        }
      } else if isRow {
        label.spinnerAtEnd(isBusy)
      } else {
        label.coveredBySpinner(isBusy)
      }
    }
    .environment(\.isBusy, isBusy)
    .accessibilityBusy(isBusy)
  }

  private func image(_ icon: ActionIcon) -> some View {
    Image(systemName: icon.rawValue)
      .accessibilityHidden(true)
      .coveredBySpinner(isBusy)
  }
}

/// What a button's press does, as one symbol per idea, the same idea main and Android show. Each
/// leads its label except `forward`, which trails it, and a busy button's spinner takes its place.
enum ActionIcon: String {
  case addLessons = "text.badge.plus"
  case back = "arrow.backward"
  case call = "phone.fill"
  case certificate = "rosette"
  /// Commits what the learner entered or picked: check, confirm, save, apply.
  case check = "checkmark"
  case create = "plus"
  case dismiss = "xmark"
  case download = "square.and.arrow.down"
  case explain = "lightbulb"
  /// Next, continue, see the result: it moves on.
  case forward = "arrow.forward"
  case notSure = "questionmark.circle"
  case notify = "bell"
  /// Starts or resumes something: a session, a lesson, a test, a mock, a task.
  case play = "play.fill"
  case print = "printer"
  case retry = "arrow.clockwise"
  case reveal = "eye"
  case send = "paperplane"
  case setDate = "calendar.badge.checkmark"
  case skip = "forward.end"
  case stop = "stop.circle"
  case undo = "arrow.uturn.backward"

  var trails: Bool { self == .forward }
}

extension EnvironmentValues {
  /// A `BusyButton`'s action is running: a press does nothing, and its style shows neither the press
  /// nor a disabled look.
  @Entry var isBusy = false
}

extension View {
  /// A busy button isn't disabled, so this is how VoiceOver says a press does nothing for now.
  func accessibilityBusy(_ isBusy: Bool) -> some View {
    accessibilityValue(
      Text(
        "In progress", tableName: "DesignSystem",
        comment: "VoiceOver's word for a button whose action is running and ignores presses"),
      isEnabled: isBusy)
  }

  /// While `isBusy`, a small spinner covers this view, which keeps its place and stays readable to
  /// VoiceOver.
  func coveredBySpinner(_ isBusy: Bool, alignment: Alignment = .center) -> some View {
    opacity(isBusy ? 0 : 1)
      // Accessibility leaves out what has no opacity, which would leave a busy button nameless.
      .accessibilityRepresentation { self }
      .overlay(alignment: alignment) {
        if isBusy {
          BusySpinner()
        }
      }
  }

  /// For a row with nothing at its end: while `isBusy`, a small spinner shows at the row's trailing
  /// edge, over the row's own space, so the row keeps its size.
  func spinnerAtEnd(_ isBusy: Bool) -> some View {
    frame(maxWidth: .infinity, alignment: .leading)
      .overlay(alignment: .trailing) {
        if isBusy {
          BusySpinner()
        }
      }
  }
}

private struct BusySpinner: View {
  var body: some View {
    ProgressView()
      .controlSize(.small)
      .tint(ForegroundStyle())
      .accessibilityHidden(true)
  }
}
