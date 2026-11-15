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

  func body(content: Content) -> some View {
    // Inside a column at most as wide, the outer column's padding already holds it.
    if let outerWidth, outerWidth <= width {
      content
    } else {
      // The room it's offered, read as it's laid out: a column that measured its own width and
      // padded by it laid an iPad's lesson out again every frame.
      GeometryReader { proxy in
        let margin = max(0, proxy.size.width - width) / 2

        content
          .environment(\.readableColumnWidth, width)
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
}

/// How far a readable column sits in from each side of the room it was offered, so a bar laid
/// over that room can line up with it.
struct ColumnMargins: Equatable {
  let leading: CGFloat
  let trailing: CGFloat
}

/// Every readable column inside a view: one for a page, two for panes side by side.
struct ColumnMarginsKey: PreferenceKey {
  static let defaultValue: [ColumnMargins] = []

  static func reduce(value: inout [ColumnMargins], nextValue: () -> [ColumnMargins]) {
    value += nextValue()
  }
}
