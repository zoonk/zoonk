import SwiftUI

/// Main's `ListGroup` as a page's `List`: flat rows with a hairline between them, as wide as the
/// column, and space rather than a line between sections. Where the width is regular it's the
/// page's one column (`pageColumn()`), in the middle as main's tablet column is; a pane is
/// narrower, so it keeps its own width. The page is the system background, which a plain list's
/// rows paint.
///
/// Rows are main's `ListRowContent`, at least 44pt high, rather than a plain list's 52pt. A row that
/// sets its own insets keeps them.
struct ZoonkList<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    List {
      // Row and section traits reach a list's rows only from inside it. A separator tint set here
      // would bring back the hairline a footer hides above itself, so hairlines keep the system's.
      // Main's 11pt sits outside a 20pt line, which centers Geist's own 18pt line at 14pt.
      content
        .listRowInsets(.vertical, 12)
        .listSectionSeparator(.hidden)
        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
        .rowLabelColumn()
    }
    .listStyle(.plain)
    .listSectionSpacing(24)
    .environment(\.defaultMinListRowHeight, 44)
    .pageColumn()
    .headsPage()
  }
}

extension View {
  /// The one column every page keeps where the width is regular: main's tablet column, 768pt in
  /// the middle of the room. A sheet is a column already, so what's in one fills it
  /// (`sheetColumn()`).
  func pageColumn() -> some View {
    modifier(PageColumn())
  }

  /// For a sheet's root: its pages fill the sheet's width, less its margins, instead of keeping the
  /// page's column inside a sheet wider than it.
  func sheetColumn() -> some View {
    environment(\.pageColumnFillsRoom, true)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var pageColumnFillsRoom = false
}

private struct PageColumn: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.pageColumnFillsRoom) private var fillsRoom

  func body(content: Content) -> some View {
    content.readableColumn(horizontalSizeClass == .regular && !fillsRoom ? 768 : .infinity)
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
  /// ink ring on its tint, where the current row's highlight would be. For `ZoonkList`'s rows.
  func pickedRow(_ isPicked: Bool) -> some View {
    // Behind the row's content rather than in `listRowBackground`, which keeps the colors it first
    // drew in: a row picked before a switch to dark mode stayed near-white under white text.
    background {
      if isPicked {
        Color.clear.answerSurface(.picked, cornerRadius: Radius.lg)
          .containerRelativeFrame(.horizontal) { width, _ in width - 12 }
          .padding(.vertical, -10)
      }
    }
    .modifier(HidesSeparators(isHidden: isPicked))
  }
}

/// SwiftUI hides a row's hairlines as soon as it's asked, but leaves them hidden while the row stays
/// on screen when asked to show them again (iOS 27.2), which a list where picking doesn't move on
/// shows. The row that stops hiding them is drawn anew, which draws its hairlines and its
/// neighbor's; the row just picked keeps its identity, so VoiceOver stays on it.
private struct HidesSeparators: ViewModifier {
  let isHidden: Bool

  @State private var redraws = 0

  func body(content: Content) -> some View {
    content
      .listRowSeparator(isHidden ? .hidden : .automatic)
      .id(redraws)
      .onChange(of: isHidden) { wasHidden, _ in
        if wasHidden {
          redraws += 1
        }
      }
  }
}
