import SwiftUI

/// A `NavigationLink` row draws its own; a button row that opens somewhere draws this one. A row
/// that shows what's under it passes `foldIsOpen`, as main's `FoldChevron`: down, turned up while
/// what it shows is open.
struct DisclosureChevron: View {
  /// UIKit's list sets its disclosure glyph's ink 2.33pt in from the content's end (iOS 27.2),
  /// where this glyph's own ink stops 0.67pt in: so both chevrons share one column.
  @ScaledMetric(relativeTo: .body) private var systemInset = 5.0 / 3

  var foldIsOpen: Bool?

  var body: some View {
    Image(systemName: foldIsOpen == nil ? "chevron.forward" : "chevron.down")
      .rotationEffect(.degrees(foldIsOpen == true ? 180 : 0))
      // The one a `NavigationLink` row draws: its size, weight and color.
      .font(.body.weight(.semibold))
      .imageScale(.small)
      .foregroundStyle(Color(.tertiaryLabel))
      .padding(.trailing, systemInset)
      .accessibilityHidden(true)
      .layoutPart(.end)
  }
}

extension View {
  /// A button row drawn like a `NavigationLink`: the content, then the chevron. The whole row
  /// takes the tap, as a list's does; a plain button in a grid's block would take it only on its
  /// words.
  func disclosureChevron() -> some View {
    HStack(spacing: 12) {
      self.environment(\.rowHasChevron, true)
      DisclosureChevron()
    }
    .contentShape(.rect)
  }

  /// A button row that starts something new, as main's `RowPlus`: the plus in the chevron's slot,
  /// so the row doesn't read as one more of the items listed under it.
  func disclosurePlus() -> some View {
    HStack(spacing: 12) {
      self.environment(\.rowHasChevron, true)
      DisclosurePlus()
    }
    .contentShape(.rect)
  }
}

/// The plus that ends a row starting something new, drawn as `DisclosureChevron` is.
struct DisclosurePlus: View {
  @ScaledMetric(relativeTo: .body) private var systemInset = 5.0 / 3

  var body: some View {
    Image(systemName: "plus")
      .font(.body.weight(.semibold))
      .imageScale(.small)
      .foregroundStyle(Color(.tertiaryLabel))
      .padding(.trailing, systemInset)
      .accessibilityHidden(true)
      .layoutPart(.end)
  }
}
