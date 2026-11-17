import SwiftUI

extension View {
  func activityPanel() -> some View {
    padding(16)
      .groupBoxStyle(PanelGroupBoxStyle(isActivityBox: true))
      .background(
        Color.muted.opacity(0.5),
        in: .rect(cornerRadius: Radius.xl + 16, style: .continuous))
  }

}
