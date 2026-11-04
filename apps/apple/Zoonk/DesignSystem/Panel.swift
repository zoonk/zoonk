import SwiftUI

extension View {
  /// Main's `Surface`: one self-contained thing on the page, on `card` with a hairline and no
  /// shadow. Never inside another panel.
  func panel(cornerRadius: CGFloat = 14) -> some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

    return background(.card, in: shape)
      .overlay(shape.strokeBorder(.border))
  }
}

/// A `GroupBox` as main's `NoticeCard`: its label as a row's title over the content, on a panel.
struct PanelGroupBoxStyle: GroupBoxStyle {
  func makeBody(configuration: Configuration) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      configuration.label
        .font(.subheadline.weight(.semibold))

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
