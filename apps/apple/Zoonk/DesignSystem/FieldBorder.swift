import SwiftUI

extension View {
  /// Main's input around a `TextField` or `TextEditor` drawn outside a list row: the stronger line,
  /// 40pt tall, and a thicker ink line while it has focus.
  func fieldBorder(isFocused: Bool = false) -> some View {
    padding(.horizontal, 12)
      .padding(.vertical, 8)
      .frame(minHeight: 40)
      .overlay {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .strokeBorder(
            isFocused ? Color(.foreground) : .input, lineWidth: isFocused ? 2 : 1)
      }
  }
}
