import SwiftUI

/// A row that shows the rows after it: they follow it as rows of their own, on the page's left
/// edge, where a `DisclosureGroup`'s content would sit indented under it.
struct FoldRow<Label: View>: View {
  @Binding var isUnfolded: Bool
  @ViewBuilder let label: Label

  var body: some View {
    DisclosureGroup(isExpanded: $isUnfolded) {
    } label: {
      label
    }
  }
}

/// Main's list footer for the rows a list leaves out ("12 more units"): quiet words on the edge
/// where the rows' titles start, and the app's fold chevron at the end.
struct MoreRowsFold: View {
  let words: Text
  @Binding var isUnfolded: Bool

  var body: some View {
    FoldRow(isUnfolded: $isUnfolded) {
      ListRow(words.foregroundStyle(.mutedForeground)) {
        // The rows' mark column, left empty.
        Color.clear.frame(width: 0, height: 0)
      }
    }
  }
}
