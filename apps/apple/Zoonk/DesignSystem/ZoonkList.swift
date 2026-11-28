import SwiftUI

/// Main's `ListGroup` as a page's `List`: flat rows with a hairline between them, as wide as the
/// column, and space rather than a line between sections. Where the width is regular it's the
/// page's one column (`pageColumn()`), in the middle as main's tablet column is; a pane is
/// narrower, so it keeps its own width. The page is the system background, which a plain list's
/// rows paint.
///
/// Rows are main's `ListRowContent`, at least 44pt high, rather than a plain list's 52pt. A row that
/// sets its own insets keeps them.
/// The space between a page list's sections.
let listSectionGap: CGFloat = 24

struct ZoonkList<Content: View>: View {
  @ViewBuilder let content: Content

  @Environment(\.listRowMargin) private var rowMargin

  var body: some View {
    ScrollViewReader { scroll in
      list.environment(\.listScroll, scroll)
    }
    .modifier(ListRowTrailingHost())
    .modifier(ListRowTrailingScope())
    .listStyle(.plain)
    .listSectionSpacing(listSectionGap)
    .environment(\.defaultMinListRowHeight, 44)
    .pageColumn()
    .headsPage()
  }

  private var list: some View {
    let margin = rowMargin
    return List {
      // Row and section traits reach a list's rows only from inside it. A separator tint set here
      // would bring back the hairline a footer hides above itself, so hairlines keep the system's.
      // Main's 11pt sits outside a 20pt line, which centers Geist's own 18pt line at 14pt.
      // A row as wide as the list's column, so its hairline ends where the column does even when
      // its words are short.
      content
        .frame(maxWidth: .infinity, alignment: .leading)
        .listRowInsets(.vertical, 12)
        .listRowInsets(.horizontal, margin)
        .listSectionSeparator(.hidden)
        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
        // With a margin of its own, a row's hairline ends where its content does, not at the
        // system's.
        .alignmentGuide(.listRowSeparatorTrailing) {
          margin == nil ? $0[.listRowSeparatorTrailing] : $0.width
        }
        .rowLabelColumn()
    }
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

  /// As wide as the page's column, for what lines up with a page from outside a list, such as the
  /// bar under a page's empty state.
  func pageColumnFrame() -> some View {
    modifier(PageColumnFrame())
  }
}

extension EnvironmentValues {
  /// Scrolls the `ZoonkList` a row is in, by the row's `id`. Its visible room is what the keyboard
  /// and a bottom bar over it leave.
  @Entry var listScroll: ScrollViewProxy?
  @Entry fileprivate var pageColumnFillsRoom = false
  /// How far folds moved a row's content in from its column's edge, so the current row's band
  /// still spans the column.
  @Entry var rowIndent: CGFloat = 0
}

private struct PageColumn: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.pageColumnFillsRoom) private var fillsRoom

  func body(content: Content) -> some View {
    content.readableColumn(pageColumnWidth(horizontalSizeClass, fillsRoom: fillsRoom))
  }
}

private struct PageColumnFrame: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.pageColumnFillsRoom) private var fillsRoom

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: pageColumnWidth(horizontalSizeClass, fillsRoom: fillsRoom))
      .frame(maxWidth: .infinity)
  }
}

private func pageColumnWidth(_ sizeClass: UserInterfaceSizeClass?, fillsRoom: Bool) -> CGFloat {
  sizeClass == .regular && !fillsRoom ? 768 : .infinity
}

extension View {
  /// The learner's row, as main's `aria-current`: `muted` behind it, 10pt past the column's edges
  /// at every margin, a row a fold indents included, without the hairlines that would cross it.
  func currentRow(_ isCurrent: Bool = true) -> some View {
    modifier(CurrentRow(isCurrent: isCurrent))
  }

  /// The learner's pick among a few choices, as main's `ChoiceRows`: the pick's fill where the current
  /// row's highlight would be, with the row's own mark. For `ZoonkList`'s rows.
  func pickedRow(_ isPicked: Bool) -> some View {
    // Behind the row's content rather than in `listRowBackground`, which keeps the colors it first
    // drew in: a row picked before a switch to dark mode stayed near-white under white text.
    frame(maxWidth: .infinity, alignment: .leading)
      .background {
        if isPicked {
          RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
            .fill(.selectedTint)
            .padding(-10)
        }
      }
      .modifier(HidesSeparators(isHidden: isPicked))
  }
}

private struct CurrentRow: ViewModifier {
  let isCurrent: Bool

  @Environment(\.rowIndent) private var rowIndent

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, alignment: .leading)
      .background {
        if isCurrent {
          RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
            .fill(.muted)
            .padding(-10)
            .padding(.leading, -rowIndent)
        }
      }
      .listRowSeparator(isCurrent ? .hidden : .automatic)
      .containerValue(\.hidesSeparatorsAround, isCurrent)
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
      .containerValue(\.hidesSeparatorsAround, isHidden)
      .onChange(of: isHidden) { wasHidden, _ in
        if wasHidden {
          redraws += 1
        }
      }
  }
}
