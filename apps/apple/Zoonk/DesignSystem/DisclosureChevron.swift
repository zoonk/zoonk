import SwiftUI

/// A `NavigationLink` row draws its own; a button row that opens somewhere draws this one.
struct DisclosureChevron: View {
  var body: some View {
    Image(systemName: "chevron.forward")
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
