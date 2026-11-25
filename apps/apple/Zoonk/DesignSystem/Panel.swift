import SwiftUI

extension View {
  /// Main's `Surface`: one self-contained thing on the page, on `card` with a hairline and no
  /// shadow. Never inside another panel.
  func panel(
    cornerRadius: CGFloat = Radius.xl, fill: Color = .card, border: Color = .border
  ) -> some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

    return background(fill, in: shape)
      .overlay(shape.strokeBorder(border))
  }

  func activityBox(cornerRadius: CGFloat = Radius.xl) -> some View {
    panel(cornerRadius: cornerRadius, fill: .boxBackground)
  }

  /// Main's `bg-muted/50 rounded-xl`: a quiet filled well, with no line, for supporting content
  /// inside a step (a picture's caption, a challenge's meters and outcome).
  func well() -> some View {
    background(Color.muted.opacity(0.5), in: .rect(cornerRadius: Radius.xl, style: .continuous))
  }

  /// Main's goal box: a panel with the field's `input` line, in ink with main's focus ring outside
  /// it while its words have focus. `softFocus` is main's composer instead: a 1pt ink ring at 35%
  /// while focused, 3pt solid ink with more contrast, and no ring outside it.
  func inputPanel(isFocused: Bool, softFocus: Bool = false) -> some View {
    modifier(InputPanel(isFocused: isFocused, softFocus: softFocus))
  }
}

private struct InputPanel: ViewModifier {
  @Environment(\.colorSchemeContrast) private var contrast

  let isFocused: Bool
  let softFocus: Bool

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)

    content
      .background(.card, in: shape)
      .overlay(shape.strokeBorder(line, lineWidth: lineWidth))
      .background {
        if isFocused && !softFocus {
          shape.focusRing()
        }
      }
  }

  private var line: Color {
    guard isFocused else {
      return .input
    }

    return softFocus && contrast != .increased
      ? Color(.foreground).opacity(0.35) : Color(.foreground)
  }

  private var lineWidth: CGFloat {
    isFocused && softFocus && contrast == .increased ? 3 : 1
  }
}

/// A `GroupBox` as main's `NoticeCard`: its label as a row's title over the content, on a panel.
struct PanelGroupBoxStyle: GroupBoxStyle {
  var isActivityBox = false

  @ViewBuilder
  func makeBody(configuration: Configuration) -> some View {
    let content = VStack(alignment: .leading, spacing: 8) {
      configuration.label
        .typeStyle(.rowTitle)

      configuration.content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    if isActivityBox {
      content.activityBox()
    } else {
      content.panel()
    }
  }
}

extension GroupBoxStyle where Self == PanelGroupBoxStyle {
  static var panel: PanelGroupBoxStyle { PanelGroupBoxStyle() }
}
