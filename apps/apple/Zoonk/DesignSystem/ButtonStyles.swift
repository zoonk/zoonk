import SwiftUI

/// Main's buttons on a native `Button`, which keeps its role, keyboard shortcut, VoiceOver and
/// pointer behavior. `controlSize` picks main's sizes: `.large` for a screen's action (44pt),
/// `.regular` (36pt), `.small` beside text (30pt). A destructive role draws main's destructive
/// button in any of them; `.icon` on any of them is main's square icon button (`size="icon"`), and
/// `.endsRow` on a ghost one is main's `edge="end"`. Glass stays on floating controls and toolbar
/// items.
struct ZoonkButtonStyle: ButtonStyle {
  enum Variant {
    /// Ink fill: one per area.
    case main
    /// See-through with the stronger line: main's `outline`.
    case outline
    /// No line: main's `ghost`, a quiet option beside or under the main action.
    case ghost

    /// As every platform's layout captures name a button's look.
    var layoutName: String {
      switch self {
      case .main: "filled"
      case .outline: "outline"
      case .ghost: "ghost"
      }
    }
  }

  let variant: Variant
  var isIcon = false
  var isAtRowEnd = false

  /// Main's `size="icon"`: a square as tall as the size, for a label that is only an icon.
  var icon: ZoonkButtonStyle { ZoonkButtonStyle(variant: variant, isIcon: true) }

  /// Main's `edge="end"`, for a ghost icon button that ends a row or a header: its glyph sits on
  /// the column's edge, where the row's other marks end, and its pressed box hangs past it.
  var endsRow: ZoonkButtonStyle {
    ZoonkButtonStyle(variant: variant, isIcon: isIcon, isAtRowEnd: true)
  }

  func makeBody(configuration: Configuration) -> some View {
    ZoonkButton(
      configuration: configuration, variant: variant, isIcon: isIcon, isAtRowEnd: isAtRowEnd
    )
    .layoutAction(configuration.role == .destructive ? "destructive" : variant.layoutName)
  }

  static func horizontalPadding(_ controlSize: ControlSize) -> CGFloat {
    switch controlSize {
    case .mini, .small: 10
    case .regular: 12
    default: 16
    }
  }
}

extension View {
  /// For a button in a list row, where a label's icon takes a column of its own, far from its
  /// words: main's 16pt icon and its gap for the button's size.
  func listRowButtonIcon() -> some View {
    modifier(ListRowButtonIcon())
  }
}

private struct ListRowButtonIcon: ViewModifier {
  @Environment(\.controlSize) private var controlSize

  func body(content: Content) -> some View {
    content
      .labelReservedIconWidth(16)
      .labelIconToTitleSpacing(gap)
  }

  /// Main's `gap-1`, `gap-1.5` and `gap-2`.
  private var gap: CGFloat {
    switch controlSize {
    case .mini, .small: 4
    case .regular: 6
    default: 8
    }
  }
}

extension ButtonStyle where Self == ZoonkButtonStyle {
  static var mainAction: ZoonkButtonStyle { ZoonkButtonStyle(variant: .main) }
  static var outline: ZoonkButtonStyle { ZoonkButtonStyle(variant: .outline) }
  static var ghost: ZoonkButtonStyle { ZoonkButtonStyle(variant: .ghost) }
}

private struct ZoonkButton: View {
  @Environment(\.isEnabled) private var isEnabledHere
  @Environment(\.isBusy) private var isBusy
  @Environment(\.controlSize) private var controlSize
  @Environment(\.buttonSizing) private var sizing
  @Environment(\.mainActionFillsRow) private var fillsRow
  @Environment(\.mainActionMinWidth) private var mainMinWidth
  @Environment(\.controlsShareHeight) private var sharesHeight
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let configuration: ButtonStyleConfiguration
  let variant: ZoonkButtonStyle.Variant
  let isIcon: Bool
  let isAtRowEnd: Bool

  var body: some View {
    let shape = RoundedRectangle(
      cornerRadius: isSmall && !isIcon ? Radius.md : Radius.lg, style: .continuous)

    labelOnlyIfMain(configuration.label)
      .environment(\.showsButtonIcon, !isLabelOnly)
      .typeStyle(isSmall ? .smallButton : .button)
      .multilineTextAlignment(.center)
      .foregroundStyle(label)
      .padding(.horizontal, isIcon ? 0 : ZoonkButtonStyle.horizontalPadding(controlSize))
      .padding(.vertical, isIcon ? 0 : 6)
      .frame(
        minWidth: isIcon ? (isAtRowEnd ? nil : height) : variant == .main ? mainMinWidth : nil,
        minHeight: height, maxHeight: sharesHeight ? .infinity : nil
      )
      .frame(maxWidth: fills && !isIcon ? .infinity : nil)
      .background {
        // At a row's end the box is centered on the glyph and as wide as any icon button's, so
        // it's the glyph, not the box, that ends on the edge.
        shape.fill(fill)
          .frame(width: isIcon && isAtRowEnd ? height : nil)
      }
      .overlay {
        if variant == .outline && !isDestructive {
          shape.strokeBorder(Color(.input))
        }
      }
      .opacity(isEnabled || variant == .main ? 1 : 0.5)
      .opacity(isPressed && reduceMotion ? 0.8 : 1)
      .scaleEffect(isPressed && !reduceMotion ? 0.97 : 1)
      .animation(.easeOut(duration: 0.15), value: isPressed)
      .contentShape(MinimumHitArea())
  }

  /// A main action is its label alone (main's rule 6): any icon its label carries stays off it.
  private var isLabelOnly: Bool { variant == .main && !isIcon }

  @ViewBuilder
  private func labelOnlyIfMain(_ label: ButtonStyleConfiguration.Label) -> some View {
    if isLabelOnly {
      label.labelStyle(.titleOnly)
    } else {
      label
    }
  }

  private var fills: Bool { sizing == .flexible || (variant == .main && fillsRow) }

  /// A busy button keeps its look even where its container is disabled, such as a form that locks
  /// while its answer saves: only its spinner says it's working.
  private var isEnabled: Bool { isEnabledHere || isBusy }

  private var isPressed: Bool { configuration.isPressed && !isBusy }

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
      return variant == .ghost && !isPressed
        ? .clear : Color.destructive.opacity(colorScheme == .dark ? 0.2 : 0.1)
    }

    switch variant {
    case .main:
      return isEnabled ? Color(.primary).opacity(isPressed ? 0.8 : 1) : .muted
    case .outline, .ghost:
      return isPressed ? .muted : .clear
    }
  }
}

/// Grows a button's hit area to 44pt in each direction it's shorter than that, as main's `hit-area` does, and
/// no further, so buttons side by side don't share the space between them.
private struct MinimumHitArea: Shape {
  func path(in rect: CGRect) -> Path {
    Path(rect.insetBy(dx: -max(0, (44 - rect.width) / 2), dy: -max(0, (44 - rect.height) / 2)))
  }
}

extension View {
  /// Controls side by side are one height: when a button's label wraps or a field beside it is
  /// taller, the row's buttons grow with it.
  func controlsShareHeight() -> some View {
    environment(\.controlsShareHeight, true)
      .fixedSize(horizontal: false, vertical: true)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var controlsShareHeight = false

  /// One main action per screen: set where the screen's bar holds it, so a button that would be the
  /// main action elsewhere (a notice's retry, a suggestion's answer) is secondary beside it. Each
  /// presented screen starts without it: its own bar is the one on it.
  @Entry var barHoldsMainAction = false
}

extension View {
  /// The main action's fill, or the outline once the screen's bar holds the main action.
  func mainActionUnlessBarHoldsOne() -> some View {
    modifier(MainActionUnlessBarHoldsOne())
  }
}

private struct MainActionUnlessBarHoldsOne: ViewModifier {
  @Environment(\.barHoldsMainAction) private var barHoldsMainAction

  func body(content: Content) -> some View {
    content.buttonStyle(ZoonkButtonStyle(variant: barHoldsMainAction ? .outline : .main))
  }
}
