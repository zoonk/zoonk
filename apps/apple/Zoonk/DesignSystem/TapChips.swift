import SwiftUI

/// One-tap answers over a field, such as example goals or questions for the buddy: outline chips
/// that wrap, in rows far enough apart that each keeps its whole 44pt touch height.
struct TapChips<Chips: View>: View {
  @ViewBuilder let chips: Chips

  var body: some View {
    FlowLayout(spacing: 8, rowSpacing: 14) {
      chips
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }
}
