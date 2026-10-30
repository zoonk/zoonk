import SwiftUI

extension View {
  /// Keeps a list's or a form's rows, and the bars inset into it, in a column at most `width` wide;
  /// its background still fills the screen. An app page's column starts at the title's edge
  /// (`.leading`); a step-by-step flow's sits in the middle.
  func readableColumn(_ width: CGFloat, alignment: HorizontalAlignment = .center) -> some View {
    modifier(ReadableColumn(width: width, alignment: alignment))
  }
}

private struct ReadableColumn: ViewModifier {
  let width: CGFloat
  let alignment: HorizontalAlignment

  @State private var available: CGFloat = 0

  func body(content: Content) -> some View {
    let room = max(0, available - width)

    content
      .safeAreaPadding(.leading, alignment == .leading ? 0 : room / 2)
      .safeAreaPadding(.trailing, alignment == .leading ? room : room / 2)
      .onGeometryChange(for: CGFloat.self) {
        $0.size.width
      } action: {
        available = $0
      }
  }
}
