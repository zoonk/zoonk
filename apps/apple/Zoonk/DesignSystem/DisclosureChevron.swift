import SwiftUI

/// A `NavigationLink` row draws its own; a button row that opens somewhere draws this one, and a
/// row that shows what's under it points it down while that is open.
struct DisclosureChevron: View {
  @Environment(\.layoutDirection) private var layoutDirection

  /// UIKit's list sets its disclosure glyph's ink 2.33pt in from the content's end (iOS 27.2),
  /// where this glyph's own ink stops 0.67pt in: so both chevrons share one column.
  @ScaledMetric(relativeTo: .body) private var systemInset = 5.0 / 3

  var pointsDown = false

  /// Turned rather than swapped for `chevron.down`, which is wider: the values before it stay on
  /// the edge where the other rows' end.
  var body: some View {
    Image(systemName: "chevron.forward")
      // About its center the turned glyph would end 1.7pt past the forward ones and sit low; about
      // this point its ink ends on their column and centers on the row.
      .rotationEffect(
        .degrees(pointsDown ? (layoutDirection == .rightToLeft ? -90 : 90) : 0),
        anchor: UnitPoint(x: 0.475, y: 0.41)
      )
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
  /// A button row drawn like a `NavigationLink`: the content, then the chevron.
  func disclosureChevron() -> some View {
    HStack(spacing: 12) {
      self
      DisclosureChevron()
    }
  }
}
