import SwiftUI

extension View {
  /// Main's quiet chip beside a title or a line (the Plus mark, a plan change's "1 week", a course's
  /// state): a short word on a faint fill, never a colored badge. A count or word at a list row's end is
  /// `.badge(_:)` instead.
  func chip() -> some View {
    font(.caption.weight(.medium))
      .foregroundStyle(.secondary)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(.fill.tertiary, in: .capsule)
      .fixedSize()
  }
}
