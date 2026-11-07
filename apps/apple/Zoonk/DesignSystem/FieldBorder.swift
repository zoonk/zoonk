import SwiftUI

extension View {
  /// Main's input around a `TextField` or `TextEditor` drawn outside a list row: the stronger line,
  /// 44pt tall (an answer's field is taller), and a thicker ink line while it has focus. An invalid
  /// field draws main's `destructive` mark with a soft 3pt ring around it; its message keeps
  /// `destructiveText`. A checked answer's field takes its verdict's line instead.
  func fieldBorder(
    isFocused: Bool = false, isInvalid: Bool = false, isRight: Bool? = nil, minHeight: CGFloat = 44
  ) -> some View {
    modifier(
      FieldBorder(
        isFocused: isFocused, isInvalid: isInvalid, isRight: isRight, minHeight: minHeight))
  }
}

private struct FieldBorder: ViewModifier {
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.colorSchemeContrast) private var contrast

  let isFocused: Bool
  let isInvalid: Bool
  let isRight: Bool?
  let minHeight: CGFloat

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)

    content
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .frame(minHeight: minHeight)
      .overlay {
        shape.strokeBorder(line, lineWidth: isFocused && isRight == nil ? 2 : 1)
      }
      .background {
        if isInvalid && isRight == nil && contrast != .increased {
          shape
            .inset(by: -1.5)
            .stroke(Color.destructive.opacity(colorScheme == .dark ? 0.4 : 0.2), lineWidth: 3)
        }
      }
  }

  /// Main's `aria-invalid:` line is half strength in dark; with more contrast every line is solid.
  private var line: Color {
    if let isRight {
      return isRight ? .success : .destructive
    }

    if isInvalid {
      return colorScheme == .dark && contrast != .increased
        ? Color.destructive.opacity(0.5) : .destructive
    }

    return isFocused ? Color(.foreground) : .input
  }
}

/// Main's field under its `Label`: the label and an optional line about it over the field, in a
/// list row or on its own. The field keeps its own label for VoiceOver, so the visible one is
/// hidden from it.
struct FormField<Field: View, Hint: View>: View {
  let title: Text
  var isFocused = false
  var isInvalid = false
  @ViewBuilder let field: Field
  @ViewBuilder let hint: Hint

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 1) {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
          .accessibilityHidden(true)

        hint
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }

      field
        .fieldBorder(isFocused: isFocused, isInvalid: isInvalid)
    }
    .padding(.vertical, 6)
  }
}

extension FormField where Hint == EmptyView {
  init(
    title: Text, isFocused: Bool = false, isInvalid: Bool = false,
    @ViewBuilder field: () -> Field
  ) {
    self.init(title: title, isFocused: isFocused, isInvalid: isInvalid, field: field) {
      EmptyView()
    }
  }
}
