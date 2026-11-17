import SwiftUI

extension View {
  func activityPanel() -> some View {
    padding(16)
      .background(
        Color.muted.opacity(0.5),
        in: .rect(cornerRadius: Radius.xl + 16, style: .continuous))
  }
}
