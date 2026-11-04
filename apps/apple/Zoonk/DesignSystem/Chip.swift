import SwiftUI

extension View {
  /// Never a colored badge. A count or word at a list row's end is `.badge(_:)` instead.
  func chip() -> some View {
    typeStyle(.chip)
      .foregroundStyle(.mutedForeground)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .frame(minHeight: 22)
      .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).strokeBorder(.input))
      .fixedSize()
  }
}
