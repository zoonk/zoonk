import SwiftUI

extension View {
  /// Main's `Surface`: one self-contained thing on the page, on `card` with a hairline and no
  /// shadow. Never inside another panel.
  func panel(cornerRadius: CGFloat = Radius.xl) -> some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

    return background(.card, in: shape)
      .overlay(shape.strokeBorder(.border))
  }

  /// Main's `bg-muted/50 rounded-xl`: a quiet filled well, with no line, for supporting content
  /// inside a step (a picture's caption, a challenge's meters and outcome).
  func well() -> some View {
    background(Color.muted.opacity(0.5), in: .rect(cornerRadius: Radius.xl, style: .continuous))
  }

  /// Main's goal box and composer: a panel with the field's `input` line, in ink while its words
  /// have focus, thicker with more contrast.
  func inputPanel(isFocused: Bool) -> some View {
    modifier(InputPanel(isFocused: isFocused))
  }
}

private struct InputPanel: ViewModifier {
  @Environment(\.colorSchemeContrast) private var contrast

  let isFocused: Bool

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
    let focusWidth: CGFloat = contrast == .increased ? 3 : 2

    content
      .background(.card, in: shape)
      .overlay(
        shape.strokeBorder(
          isFocused ? Color(.foreground) : .input, lineWidth: isFocused ? focusWidth : 1))
  }
}

/// A `GroupBox` as main's `NoticeCard`: its label as a row's title over the content, on a panel.
struct PanelGroupBoxStyle: GroupBoxStyle {
  func makeBody(configuration: Configuration) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      configuration.label
        .typeStyle(.rowTitle)

      configuration.content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .panel()
  }
}

extension GroupBoxStyle where Self == PanelGroupBoxStyle {
  static var panel: PanelGroupBoxStyle { PanelGroupBoxStyle() }
}
