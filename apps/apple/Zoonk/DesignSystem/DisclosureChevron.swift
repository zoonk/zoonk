import SwiftUI

/// A `NavigationLink` row draws its own; a button row that opens somewhere draws this one, and a
/// row that shows what's under it points it down while that is open.
struct DisclosureChevron: View {
  var pointsDown = false

  var body: some View {
    Image(systemName: pointsDown ? "chevron.down" : "chevron.forward")
      .typeStyle(.note.weight(.semibold))
      .foregroundStyle(Color.mutedForeground.opacity(0.6))
      .accessibilityHidden(true)
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
