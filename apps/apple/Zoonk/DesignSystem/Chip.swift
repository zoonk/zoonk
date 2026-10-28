import SwiftUI

extension View {
  /// Never a colored badge. A count or word at a list row's end is `.badge(_:)` instead.
  func chip() -> some View {
    font(.caption.weight(.medium))
      .foregroundStyle(.secondary)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(.fill.tertiary, in: .capsule)
      .fixedSize()
  }
}
