import SwiftUI

/// Main's buttons on a native `Button`, which keeps its role, keyboard shortcut, VoiceOver and
/// pointer behavior. `controlSize` picks main's sizes: `.large` for a screen's action (44pt),
/// `.regular` (36pt), `.small` beside text (30pt). A destructive role draws main's destructive
/// button in any of them; `.icon` on any of them is main's square icon button (`size="icon"`), and
/// `.endsRow` on a ghost one is main's `edge="end"`. Glass stays on floating controls and toolbar
/// items. Each shows its label and the one icon it carries, before its words or, with
/// `.labelStyle(.trailingIcon)`, after them; the main action that Return presses carries none, as
/// main's `EnterButton` takes none.
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
  var isTight = false

  /// Main's `size="icon"`: a square as tall as the size, for a label that is only an icon.
  var icon: ZoonkButtonStyle { ZoonkButtonStyle(variant: variant, isIcon: true) }

  /// Main's `edge="end"`, for a ghost button that ends a row or a header: its glyph or its words
  /// sit on the column's edge, where the row's other marks end, and its pressed box hangs past it.
  var endsRow: ZoonkButtonStyle {
    ZoonkButtonStyle(variant: variant, isIcon: isIcon, isAtRowEnd: true)
  }

  /// Main's `px-3` on a large button, for the quieter of two answers on a phone's bar, so the main
  /// action beside it keeps the larger part.
  var tight: ZoonkButtonStyle { ZoonkButtonStyle(variant: variant, isTight: true) }

  func makeBody(configuration: Configuration) -> some View {
    ZoonkButton(
      configuration: configuration, variant: variant, isIcon: isIcon, isAtRowEnd: isAtRowEnd,
      isTight: isTight
    )
    .layoutAction(configuration.role == .destructive ? "destructive" : variant.layoutName)
  }

  /// A button's height at a control size, for text that stands in a button's place.
  static func height(_ controlSize: ControlSize) -> CGFloat {
    switch controlSize {
    case .mini: 24
    case .small: 30
    case .regular: 36
    default: 44
    }
  }

  /// Main's `gap-1`, `gap-1.5` and `gap-2`, between a button's icon and its words.
  static func iconGap(_ controlSize: ControlSize) -> CGFloat {
    switch controlSize {
    case .mini, .small: 4
    case .regular: 6
    default: 8
    }
  }

  static func horizontalPadding(_ controlSize: ControlSize) -> CGFloat {
    switch controlSize {
    case .mini, .small: 10
    case .regular: 12
    default: 16
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
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.buttonTone) private var tone

  let configuration: ButtonStyleConfiguration
  let variant: ZoonkButtonStyle.Variant
  let isIcon: Bool
  let isAtRowEnd: Bool
  let isTight: Bool

  var body: some View {
    let shape = RoundedRectangle(
      cornerRadius: isSmall && !isIcon ? Radius.md : Radius.lg, style: .continuous)

    configuration.label
      // A list would set the icon in a column of its own, far from its words.
      .labelReservedIconWidth(16)
      .labelIconToTitleSpacing(ZoonkButtonStyle.iconGap(controlSize))
      .typeStyle(isSmall ? .smallButton : .button)
      .multilineTextAlignment(.center)
      .foregroundStyle(label)
      .padding(.horizontal, isIcon ? 0 : horizontalPadding)
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
          shape.strokeBorder(tone == .warning ? Color.warning : Color(.input))
        }
      }
      .opacity(isEnabled || variant == .main ? 1 : 0.5)
      .opacity(isPressed && reduceMotion ? 0.8 : 1)
      .scaleEffect(isPressed && !reduceMotion ? 0.97 : 1)
      .animation(.easeOut(duration: 0.15), value: isPressed)
      .contentShape(MinimumHitArea())
      .padding(
        .trailing, isAtRowEnd && !isIcon ? -ZoonkButtonStyle.horizontalPadding(controlSize) : 0)
  }

  private var fills: Bool { sizing == .flexible || (variant == .main && fillsRow) }

  private var horizontalPadding: CGFloat {
    let padding = ZoonkButtonStyle.horizontalPadding(controlSize)
    return isTight ? min(padding, 12) : padding
  }

  /// A busy button keeps its look even where its container is disabled, such as a form that locks
  /// while its answer saves: only its spinner says it's working.
  private var isEnabled: Bool { isEnabledHere || isBusy }

  private var isPressed: Bool { configuration.isPressed && !isBusy }

  private var isSmall: Bool { controlSize <= .small }

  private var isDestructive: Bool { configuration.role == .destructive }

  private var height: CGFloat { ZoonkButtonStyle.height(controlSize) }

  private var label: Color {
    if isDestructive {
      return .destructiveText
    }

    if variant == .main {
      return isEnabled ? Color(.primaryForeground) : .mutedForeground
    }

    return tone == .warning ? .warningText : Color(.foreground)
  }

  private var fill: Color {
    if isDestructive {
      return variant == .ghost && !isPressed ? .clear : .destructiveSoft
    }

    switch variant {
    case .main:
      return isEnabled ? Color(.primary).opacity(isPressed ? 0.8 : 1) : Color(.secondary)
    case .outline, .ghost:
      return isPressed ? .muted : .clear
    }
  }
}

/// Main's `iconPosition="end"`: the words, then the icon, at the button's icon gap, for an icon that
/// says where the press leads (forward, out to another app, a menu that opens).
struct TrailingIconLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    TrailingIconLabel(configuration: configuration)
  }
}

extension LabelStyle where Self == TrailingIconLabelStyle {
  static var trailingIcon: TrailingIconLabelStyle { TrailingIconLabelStyle() }
}

private struct TrailingIconLabel: View {
  @Environment(\.controlSize) private var controlSize

  let configuration: LabelStyleConfiguration

  var body: some View {
    HStack(spacing: ZoonkButtonStyle.iconGap(controlSize)) {
      configuration.title
      configuration.icon
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

/// Main's toned outline (`border-warning text-warning-text`), for a toggle whose on state is a
/// warning, such as a mock exam question the learner isn't sure of.
enum ButtonTone {
  case neutral
  case warning
}

extension View {
  func buttonTone(_ tone: ButtonTone) -> some View {
    environment(\.buttonTone, tone)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var controlsShareHeight = false
  @Entry fileprivate var buttonTone = ButtonTone.neutral

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
