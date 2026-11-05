import SwiftUI

/// Main's `StepsBackButton`: back one step, at the start of a task's bar.
struct StepBackButton: View {
  let label: Text
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Label {
        label
      } icon: {
        Image(systemName: "chevron.left")
      }
      .labelStyle(.iconOnly)
      .frame(minHeight: 32)
    }
    .buttonStyle(.bordered)
    .buttonBorderShape(.circle)
    .controlSize(.large)
    .keyboardShortcut(.leftArrow, modifiers: [])
  }
}
