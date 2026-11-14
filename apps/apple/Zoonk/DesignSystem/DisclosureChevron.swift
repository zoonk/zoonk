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
      // `chevron.forward` draws its ink right of its frame's center, so a turn about the center
      // leaves it 1.1pt low and 0.7pt past the row's end; about this point it sits where a forward
      // one does.
      .rotationEffect(
        .degrees(pointsDown ? (layoutDirection == .rightToLeft ? -90 : 90) : 0),
        anchor: UnitPoint(x: 0.5, y: 0.41)
      )
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
