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
        .preference(
          key: ColumnMarginsKey.self,
          value: [ColumnMargins(leading: 0, trailing: 0, outerPadding: outerMargin)])
    } else {
      // The room it's offered, read as it's laid out: a column that measured its own width and
      // padded by it laid an iPad's lesson out again every frame.
      GeometryReader { proxy in
        let margin = max(0, proxy.size.width - width) / 2

        content
          .environment(\.readableColumnWidth, width)
          .environment(\.readableColumnMargin, margin)
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
}

/// How far a readable column sits in from each side of the room it was offered, so a bar laid
/// over that room can line up with it.
struct ColumnMargins: Equatable {
  let leading: CGFloat
  let trailing: CGFloat
  /// Padding an outer column gave the room, for a column that sits inside one.
  var outerPadding: CGFloat?

  /// Where a list's rows start inside this column, given the system's margin. A list takes that
  /// margin inside padding given to it, but inside an outer column's padding UIKit puts its rows
  /// the system's margin from the window's edge and at least a view's default 8pt inside the
  /// padding, as `layoutMargins` measures from the safe area.
  func rowInset(_ systemMargin: CGFloat) -> CGFloat {
    guard let outerPadding else { return systemMargin }

    return max(systemMargin, outerPadding + 8) - outerPadding
  }
}

/// Every readable column inside a view: one for a page, two for panes side by side.
struct ColumnMarginsKey: PreferenceKey {
  static let defaultValue: [ColumnMargins] = []

  static func reduce(value: inout [ColumnMargins], nextValue: () -> [ColumnMargins]) {
    value += nextValue()
  }
}
