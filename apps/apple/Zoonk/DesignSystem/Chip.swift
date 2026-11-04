import SwiftUI

extension View {
  /// Never a colored badge. A count or word at a list row's end is `.badge(_:)` instead.
  func chip() -> some View {
    font(.caption.weight(.medium))
      .foregroundStyle(.mutedForeground)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .frame(minHeight: 22)
      .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.input))
      .fixedSize()
  }
}
