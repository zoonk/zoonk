import SwiftUI

/// One-tap answers over a field, such as example goals or questions for the buddy: main's outline
/// buttons at a touch control's full 44pt, wrapping 8pt apart each way.
struct TapChips<Chips: View>: View {
  @ViewBuilder let chips: Chips

  var body: some View {
    FlowLayout(spacing: 8) {
      chips
    }
    .buttonStyle(.outline)
    .controlSize(.large)
  }
}
