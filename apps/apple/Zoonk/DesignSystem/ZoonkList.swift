import SwiftUI

/// Main's `ListGroup` as a page's `List`: flat rows with a hairline in `border` between them, as wide
/// as the column, and space rather than a line between sections. Where the width is regular it's
/// one centered column at most 768pt wide, as main's tablet portrait; a pane is narrower, so it keeps
/// its own width. The page is the system background, which a plain list's rows paint.
struct ZoonkList<Content: View>: View {
  @ViewBuilder let content: Content

  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  var body: some View {
    List {
      // Row and section traits reach a list's rows only from inside it; a row that sets its own
      // keeps it.
      content
        .listRowSeparatorTint(.border)
        .listSectionSeparator(.hidden)
        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
    }
    .listStyle(.plain)
    .listSectionSpacing(24)
    .readableColumn(horizontalSizeClass == .regular ? 768 : .infinity)
  }
}

extension View {
  /// The learner's row, as main's `aria-current`: `muted` behind it, reaching a little past the
  /// column's edges, without the hairlines that would cross it.
  func currentRow(_ isCurrent: Bool = true) -> some View {
    listRowBackground(isCurrent ? RowHighlight() : nil)
      .listRowSeparator(isCurrent ? .hidden : .automatic)
  }
}

private struct RowHighlight: View {
  var body: some View {
    RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
      .fill(.muted)
      .padding(.horizontal, 6)
      .padding(.vertical, 2)
  }
}
