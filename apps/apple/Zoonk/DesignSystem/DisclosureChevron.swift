import SwiftUI

/// A `NavigationLink` row draws its own; a button row that opens somewhere draws this one, and a
/// row that shows what's under it points it down while that is open.
struct DisclosureChevron: View {
  @Environment(\.layoutDirection) private var layoutDirection

  var pointsDown = false

  /// Turned rather than swapped for `chevron.down`, which is wider: the values before it stay on
  /// the edge where the other rows' end.
  var body: some View {
    Image(systemName: "chevron.forward")
      .rotationEffect(.degrees(pointsDown ? (layoutDirection == .rightToLeft ? -90 : 90) : 0))
      .typeStyle(.note.weight(.semibold))
      .foregroundStyle(Color.mutedForeground.opacity(0.6))
      .accessibilityHidden(true)
      .layoutPart(.end)
  }
}

extension View {
  /// A button row drawn like a `NavigationLink`: the content, then the chevron.
  func disclosureChevron() -> some View {
    HStack(spacing: 12) {
      self
      DisclosureChevron()
    }
  }
}
