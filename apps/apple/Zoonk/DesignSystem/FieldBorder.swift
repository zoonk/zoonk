import SwiftUI

extension View {
  /// Main's input around a `TextField` or `TextEditor` drawn outside a list row: the stronger line,
  /// 40pt tall (an answer's field is taller), and a thicker ink line while it has focus. A checked
  /// answer's field takes its verdict's line instead.
  func fieldBorder(isFocused: Bool = false, isRight: Bool? = nil, minHeight: CGFloat = 40)
    -> some View
  {
    let line: Color =
      switch isRight {
      case true?: .success
      case false?: .destructive
      case nil: isFocused ? Color(.foreground) : .input
      }

    return padding(.horizontal, 12)
      .padding(.vertical, 8)
      .frame(minHeight: minHeight)
      .overlay {
        RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
          .strokeBorder(line, lineWidth: isFocused && isRight == nil ? 2 : 1)
      }
  }
}
