import SwiftUI

extension View {
  /// Main's `ListGroup` for a page's `List`: flat rows on the page with a hairline between them, as
  /// wide as the column. Where the width is regular it's one centered column at most 768pt wide, as
  /// main's tablet portrait; a pane is narrower, so it keeps its own width. The page is the system
  /// background, which a plain list's rows paint whatever is behind them.
  func zoonkList() -> some View {
    modifier(ZoonkList())
  }

  /// The learner's row, as main's `aria-current`: `muted` behind it, reaching a little past the
  /// column's edges.
  func currentRow(_ isCurrent: Bool = true) -> some View {
    listRowBackground(isCurrent ? RowHighlight() : nil)
  }
}

private struct ZoonkList: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  func body(content: Content) -> some View {
    content
      .listStyle(.plain)
      .listSectionSpacing(24)
      .readableColumn(horizontalSizeClass == .regular ? 768 : .infinity)
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
