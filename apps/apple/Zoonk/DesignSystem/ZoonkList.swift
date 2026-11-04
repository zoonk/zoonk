import SwiftUI

/// Main's `ListGroup` as a page's `List`: flat rows with a hairline between them, as wide as the
/// column, and space rather than a line between sections. Where the width is regular it's
/// one centered column at most 768pt wide, as main's tablet portrait; a pane is narrower, so it keeps
/// its own width. The page is the system background, which a plain list's rows paint.
///
/// Rows are main's `ListRowContent`, at least 44pt high, rather than a plain list's 52pt. A row that
/// sets its own insets keeps them.
struct ZoonkList<Content: View>: View {
  @ViewBuilder let content: Content

  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  var body: some View {
    List {
      // Row and section traits reach a list's rows only from inside it. A separator tint set here
      // would bring back the hairline a footer hides above itself, so hairlines keep the system's.
      // Main's 11pt sits outside a 20pt line, which centers Geist's own 18pt line at 14pt.
      content
        .listRowInsets(.vertical, 12)
        .listSectionSeparator(.hidden)
        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
    }
    .listStyle(.plain)
    .listSectionSpacing(24)
    .environment(\.defaultMinListRowHeight, 44)
    .readableColumn(horizontalSizeClass == .regular ? 768 : .infinity)
  }
}

extension View {
  /// The learner's row, as main's `aria-current`: `muted` behind it, reaching a little past the
  /// column's edges, without the hairlines that would cross it.
  func currentRow(_ isCurrent: Bool = true) -> some View {
    listRowBackground(
      isCurrent
        ? RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
          .fill(.muted)
          .padding(.horizontal, 6)
          .padding(.vertical, 2)
        : nil
    )
    .listRowSeparator(isCurrent ? .hidden : .automatic)
  }

  /// The learner's pick among a few choices, as main's `ChoiceRows`: the answer surface's pick, an
  /// ink ring on its tint, where the current row's highlight would be.
  func pickedRow(_ isPicked: Bool) -> some View {
    listRowBackground(
      isPicked
        ? Color.clear.answerSurface(.picked, cornerRadius: Radius.lg)
          .padding(.horizontal, 6)
          .padding(.vertical, 2)
        : nil
    )
    .listRowSeparator(isPicked ? .hidden : .automatic)
  }
}
