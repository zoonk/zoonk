import SwiftUI

extension Duration {
  /// Main's `SLOW_MS`: a wait this long is slow, so it starts to show.
  static let slowWait = Duration.milliseconds(1_500)
}

/// A button whose action is running: from the tap it ignores taps and looks disabled, and once the wait
/// is slow a spinner covers its label. The label keeps its place, so the button never changes size, a
/// quick action never blinks, and VoiceOver still reads it.
struct BusyButton<Label: View>: View {
  let isBusy: Bool
  var role: ButtonRole?
  let action: () -> Void
  @ViewBuilder let label: Label

  var body: some View {
    Button(role: role, action: action) {
      label.modifier(BusyLabel(isBusy: isBusy))
    }
    .disabled(isBusy)
  }
}

private struct BusyLabel: ViewModifier {
  let isBusy: Bool

  @State private var isSlow = false

  func body(content: Content) -> some View {
    let showsSpinner = isBusy && isSlow

    content
      .opacity(showsSpinner ? 0 : 1)
      .overlay {
        if showsSpinner {
          ProgressView()
            .controlSize(.small)
            .tint(.primary)
            .accessibilityHidden(true)
        }
      }
      .task(id: isBusy) {
        isSlow = false

        guard isBusy, (try? await Task.sleep(for: .slowWait)) != nil else {
          return
        }

        isSlow = true
      }
  }
}
