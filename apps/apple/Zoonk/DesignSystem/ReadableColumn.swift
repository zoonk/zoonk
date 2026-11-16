import SwiftUI

extension View {
  /// Keeps a list's or a form's rows, and the bars inset into it, in a column at most `width` wide,
  /// in the middle of the room; its background still fills the screen. Like a list, it takes all
  /// the room it's offered.
  func readableColumn(_ width: CGFloat) -> some View {
    modifier(ReadableColumn(width: width))
  }
}

private struct ReadableColumn: ViewModifier {
  let width: CGFloat

  @Environment(\.readableColumnWidth) private var outerWidth
  @Environment(\.readableColumnMargin) private var outerMargin

  func body(content: Content) -> some View {
    // Inside a column at most as wide, the outer column's padding already holds it.
    if let outerWidth, outerWidth <= width {
      content
        .preference(key: ColumnMarginsKey.self, value: [ColumnMargins(leading: 0, trailing: 0)])
    } else {
      // The room it's offered, read as it's laid out: a column that measured its own width and
      // padded by it laid an iPad's lesson out again every frame.
      GeometryReader { proxy in
        let margin = max(0, proxy.size.width - width) / 2

        content
          .environment(\.readableColumnWidth, width)
          .environment(\.readableColumnMargin, margin)
          // Under a bottom bar UIKit puts a list's rows only 8pt inside padding an ancestor gave,
          // so a list in this column keeps the system's margin itself, the one the bar takes.
          .environment(\.listRowMargin, margin > 0 ? regularListMargin : nil)
          .safeAreaPadding(.horizontal, margin)
          .preference(
            key: ColumnMarginsKey.self, value: [ColumnMargins(leading: margin, trailing: margin)]
          )
      }
    }
  }
}

extension EnvironmentValues {
  @Entry fileprivate var readableColumnWidth: CGFloat?
  @Entry fileprivate var readableColumnMargin: CGFloat = 0
  /// The margin a list's rows keep inside an outer column, where the system's isn't kept for them.
  @Entry var listRowMargin: CGFloat?
}

extension View {
  /// For a presented screen's root: it isn't inside the column of the page it covers.
  func outsideReadableColumns() -> some View {
    environment(\.readableColumnWidth, nil)
      .environment(\.readableColumnMargin, 0)
      .environment(\.listRowMargin, nil)
  }
}

/// How far a readable column sits in from each side of the room it was offered, so a bar laid
/// over that room can line up with it.
struct ColumnMargins: Equatable {
  let leading: CGFloat
  let trailing: CGFloat
}

/// The system's minimum margin for a regular width, which a list keeps itself where the system
/// wouldn't give it: inside an outer column, and in a pane.
let regularListMargin: CGFloat = 20

/// Every readable column inside a view: one for a page, two for panes side by side.
struct ColumnMarginsKey: PreferenceKey {
  static let defaultValue: [ColumnMargins] = []

  static func reduce(value: inout [ColumnMargins], nextValue: () -> [ColumnMargins]) {
    value += nextValue()
  }
}
