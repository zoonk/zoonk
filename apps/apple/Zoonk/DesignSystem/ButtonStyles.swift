import SwiftUI

/// Main's buttons on a native `Button`, which keeps its role, keyboard shortcut, VoiceOver and
/// pointer behavior. `controlSize` picks main's sizes: `.large` for a screen's action (44pt),
/// `.regular` (36pt), `.small` beside text (30pt). A destructive role draws main's destructive
/// button in any of them. Glass stays on floating controls and toolbar items.
struct ZoonkButtonStyle: ButtonStyle {
  enum Variant {
    /// Ink fill: one per area.
    case main
    /// See-through with the stronger line: main's `outline`.
    case outline
    /// No line: main's `ghost`, a quiet option beside or under the main action.
    case ghost
  }

  let variant: Variant

  func makeBody(configuration: Configuration) -> some View {
    ZoonkButton(configuration: configuration, variant: variant)
  }
}

extension ButtonStyle where Self == ZoonkButtonStyle {
  static var mainAction: ZoonkButtonStyle { ZoonkButtonStyle(variant: .main) }
  static var outline: ZoonkButtonStyle { ZoonkButtonStyle(variant: .outline) }
  static var ghost: ZoonkButtonStyle { ZoonkButtonStyle(variant: .ghost) }
}

private struct ZoonkButton: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.controlSize) private var controlSize
  @Environment(\.buttonSizing) private var sizing
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let configuration: ButtonStyleConfiguration
  let variant: ZoonkButtonStyle.Variant

  var body: some View {
    let shape = RoundedRectangle(
      cornerRadius: isSmall ? Radius.md : Radius.lg, style: .continuous)

    configuration.label
      .typeStyle(isSmall ? .smallButton : .button)
      .multilineTextAlignment(.center)
      .foregroundStyle(label)
      .padding(.horizontal, horizontalPadding)
      .padding(.vertical, 6)
      .frame(minHeight: height)
      .frame(maxWidth: sizing == .flexible ? .infinity : nil)
      .background(fill, in: shape)
      .overlay {
        if variant == .outline && !isDestructive {
          shape.strokeBorder(Color(.input))
        }
      }
      .opacity(isEnabled || variant == .main ? 1 : 0.5)
      .opacity(configuration.isPressed && reduceMotion ? 0.8 : 1)
      .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
      .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
      // Small buttons still take 44pt to press, as main's `hit-area` does.
      .contentShape(Rectangle().inset(by: -max(0, (44 - height) / 2)))
  }

  private var isSmall: Bool { controlSize <= .small }

  private var isDestructive: Bool { configuration.role == .destructive }

  private var height: CGFloat {
    switch controlSize {
    case .mini: 24
    case .small: 30
    case .regular: 36
    default: 44
    }
  }

  private var horizontalPadding: CGFloat {
    switch controlSize {
    case .mini, .small: 10
    case .regular: 12
    default: 16
    }
  }

  private var label: Color {
    if isDestructive {
      return .destructiveText
    }

    if variant == .main {
      return isEnabled ? Color(.primaryForeground) : .mutedForeground
    }

    return Color(.foreground)
  }

  private var fill: Color {
    if isDestructive {
      return variant == .ghost && !configuration.isPressed
        ? .clear : Color.destructive.opacity(colorScheme == .dark ? 0.2 : 0.1)
    }

    switch variant {
    case .main:
      return isEnabled ? Color(.primary).opacity(configuration.isPressed ? 0.8 : 1) : .muted
    case .outline, .ghost:
      return configuration.isPressed ? .muted : .clear
    }
  }
}
