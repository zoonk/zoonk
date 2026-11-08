import SwiftUI

extension View {
  /// Keeps a list's or a form's rows, and the bars inset into it, in a column at most `width` wide;
  /// its background still fills the screen. An app page's column starts at the title's edge
  /// (`.leading`); a step-by-step flow's sits in the middle.
  func readableColumn(_ width: CGFloat, alignment: HorizontalAlignment = .center) -> some View {
    modifier(ReadableColumn(width: width, alignment: alignment))
  }

  /// `readableColumn` for a screen that takes all the room it's offered, such as onboarding's: it
  /// fits the width in the same layout pass, so the columns inside it never re-pad it.
  func readableScreen(_ width: CGFloat) -> some View {
    GeometryReader { proxy in
      safeAreaPadding(.horizontal, max(0, proxy.size.width - width) / 2)
        .environment(\.readableColumnWidth, width)
    }
  }
}

private struct ReadableColumn: ViewModifier {
  let width: CGFloat
  let alignment: HorizontalAlignment

  @Environment(\.readableColumnWidth) private var outerWidth
  @State private var available: CGFloat = 0

  func body(content: Content) -> some View {
    // A column inside one at most as wide already fits: it neither pads nor measures, since two
    // that each measured their width and padded by it re-padded each other forever while an iPad
    // rotated.
    let isInside = outerWidth <= width
    let room = isInside ? 0 : max(0, available - width)

    content
      .environment(\.readableColumnWidth, min(width, outerWidth))
      .safeAreaPadding(.leading, alignment == .leading ? 0 : room / 2)
      .safeAreaPadding(.trailing, alignment == .leading ? room : room / 2)
      .onGeometryChange(for: CGFloat.self) {
        $0.size.width
      } action: {
        if !isInside {
          available = $0
        }
      }
  }
}

extension EnvironmentValues {
  @Entry fileprivate var readableColumnWidth: CGFloat = .infinity
}
