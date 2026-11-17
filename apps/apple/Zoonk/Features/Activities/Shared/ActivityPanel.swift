import SwiftUI

extension View {
  func activityPanel() -> some View {
    padding(16)
      .groupBoxStyle(PanelGroupBoxStyle(fill: .boxBackground))
      .background(
        Color.muted.opacity(0.5),
        in: .rect(cornerRadius: Radius.xl + 16, style: .continuous))
  }

  func activityBox(cornerRadius: CGFloat = Radius.xl) -> some View {
    panel(cornerRadius: cornerRadius, fill: .boxBackground)
  }
}
