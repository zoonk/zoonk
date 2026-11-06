import SwiftUI

extension Duration {
  /// Main's `SLOW_MS`: a wait this long is slow, so it starts to show.
  static let slowWait = Duration.milliseconds(1_500)
}

/// A button whose action is running: from the tap it ignores taps and looks disabled, and once the wait
/// is slow a spinner covers its label. The label keeps its place, so the button never changes size, a
/// quick action never blinks, and VoiceOver still reads it. A list row keeps its content instead: it's a
/// plain `Button`, disabled while busy, whose mark or end shows the spinner.
struct BusyButton<Label: View>: View {
  let isBusy: Bool
  var role: ButtonRole?
  let action: () -> Void
  @ViewBuilder let label: Label

  var body: some View {
    Button(role: role, action: action) {
      label.coveredBySpinnerWhenSlow(isBusy)
    }
    .disabled(isBusy)
  }
}

extension View {
  /// Once `isBusy` has lasted `Duration.slowWait`, a small spinner covers this view, which keeps its place
  /// and stays readable to VoiceOver. It goes the moment the work ends.
  func coveredBySpinnerWhenSlow(_ isBusy: Bool, alignment: Alignment = .center) -> some View {
    SlowWait(isBusy: isBusy) { isSlow in
      self.opacity(isSlow ? 0 : 1)
        .overlay(alignment: alignment) {
          if isSlow {
            BusySpinner()
          }
        }
    }
  }

  /// For a row with nothing at its end: once `isBusy` has lasted `Duration.slowWait`, a small spinner shows
  /// at the row's trailing edge, over the row's own space, so the row keeps its size.
  func spinnerAtEndWhenSlow(_ isBusy: Bool) -> some View {
    SlowWait(isBusy: isBusy) { isSlow in
      self.frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .trailing) {
          if isSlow {
            BusySpinner()
          }
        }
    }
  }
}

/// Whether the wait `isBusy` started has lasted `Duration.slowWait`; false again the moment it ends.
private struct SlowWait<Content: View>: View {
  let isBusy: Bool
  @ViewBuilder let content: (_ isSlow: Bool) -> Content

  @State private var hasLasted = false

  var body: some View {
    content(isBusy && hasLasted)
      .task(id: isBusy) {
        hasLasted = false

        guard isBusy, (try? await Task.sleep(for: .slowWait)) != nil else {
          return
        }

        hasLasted = true
      }
  }
}

private struct BusySpinner: View {
  var body: some View {
    ProgressView()
      .controlSize(.small)
      .tint(.primary)
      .accessibilityHidden(true)
  }
}
