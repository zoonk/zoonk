import SwiftUI

extension View {
  /// Keeps a list's or a form's rows, and the bars inset into it, in a column at most `width` wide;
  /// its background still fills the screen. An app page's column starts at the title's edge
  /// (`.leading`); a step-by-step flow's sits in the middle. Like a list, it takes all the room it's
  /// offered.
  func readableColumn(_ width: CGFloat, alignment: HorizontalAlignment = .center) -> some View {
    modifier(ReadableColumn(width: width, alignment: alignment))
  }
}

private struct ReadableColumn: ViewModifier {
  let width: CGFloat
  let alignment: HorizontalAlignment

  @Environment(\.readableColumnWidth) private var outerWidth

  func body(content: Content) -> some View {
    // Inside a column at most as wide, the outer column's padding already holds it.
    if let outerWidth, outerWidth <= width {
      content
    } else {
      // The room it's offered, read as it's laid out: a column that measured its own width and
      // padded by it laid an iPad's lesson out again every frame.
      GeometryReader { proxy in
        let room = max(0, proxy.size.width - width)
        let leading = alignment == .leading ? 0 : room / 2
        let trailing = alignment == .leading ? room : room / 2

        content
          .environment(\.readableColumnWidth, width)
          .safeAreaPadding(.leading, leading)
          .safeAreaPadding(.trailing, trailing)
          .preference(
            key: ColumnMarginsKey.self, value: [ColumnMargins(leading: leading, trailing: trailing)]
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
