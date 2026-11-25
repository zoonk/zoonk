import SwiftUI
import UIKit

extension View {
  /// Main's input around a `TextField` or `TextEditor` drawn outside a list row: the stronger line,
  /// 44pt tall (an answer's field is taller), and while it has focus the line in ink with main's
  /// focus ring outside it. An invalid field draws main's `destructive` mark with a soft 3pt ring
  /// around it; its message keeps `destructiveText`. A checked answer's field takes its verdict's
  /// line instead. A field that `holdsFocus` for a whole task and fills the screen, such as a
  /// written answer, keeps a soft line and no ring while focused, as main's writing field does; the
  /// ink line and its ring come back with more contrast.
  func fieldBorder(
    isFocused: Bool = false, isInvalid: Bool = false, isRight: Bool? = nil, minHeight: CGFloat = 44,
    holdsFocus: Bool = false
  ) -> some View {
    modifier(
      FieldBorder(
        isFocused: isFocused, isInvalid: isInvalid, isRight: isRight, minHeight: minHeight,
        holdsFocus: holdsFocus))
  }
}

extension InsettableShape {
  /// Main's `ring-[3px] ring-ring/50` just outside a focused field's ink line, more contrast
  /// included.
  func focusRing() -> some View {
    ringOutside(Color(.foreground).opacity(0.5))
  }

  /// A 3pt ring just outside the shape's line, its corners following the shape's own.
  func ringOutside(_ color: Color) -> some View {
    inset(by: -1.5).stroke(color, lineWidth: 3)
  }
}

private struct FieldBorder: ViewModifier {
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.colorSchemeContrast) private var contrast

  let isFocused: Bool
  let isInvalid: Bool
  let isRight: Bool?
  let minHeight: CGFloat
  let holdsFocus: Bool

  private var softFocus: Bool { holdsFocus && contrast != .increased }

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)

    content
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .frame(minHeight: minHeight)
      .background(.boxBackground, in: shape)
      .overlay {
        shape.strokeBorder(line)
      }
      .background {
        if isInvalid && isRight == nil {
          if contrast != .increased {
            shape.ringOutside(Color.destructive.opacity(colorScheme == .dark ? 0.4 : 0.2))
          }
        } else if isFocused && !softFocus {
          shape.focusRing()
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

    if isFocused, softFocus {
      return Color(.foreground).opacity(0.35)
    }

    return isFocused ? Color(.foreground) : .input
  }
}

/// Main's field under its `Label`: the label and an optional line about it over the field, in a
/// list row or on its own. The field keeps its own label for VoiceOver, so the visible one is
/// hidden from it. In a `ZoonkList`, a field taking focus scrolls clear of the keyboard and the
/// bottom bar over it: the system clears only the keyboard.
struct FormField<Field: View, Hint: View>: View {
  let title: Text
  var isFocused = false
  var isInvalid = false
  @ViewBuilder let field: Field
  @ViewBuilder let hint: Hint

  @Environment(\.listScroll) private var scroll
  @State private var row = UUID()

  var body: some View {
    form
      .id(row)
      .onChange(of: isFocused) {
        showIfFocused()
      }
      .onReceive(
        NotificationCenter.default.publisher(for: UIResponder.keyboardDidShowNotification)
      ) { _ in
        showIfFocused()
      }
  }

  private func showIfFocused() {
    if isFocused {
      withAnimation {
        scroll?.scrollTo(row)
      }
    }
  }

  private var form: some View {
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
