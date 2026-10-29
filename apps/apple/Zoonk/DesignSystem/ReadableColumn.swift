import SwiftUI

extension View {
  /// Keeps a list's or a form's rows, and the bars inset into it, in a centered column at most
  /// `width` wide; its background still fills the screen.
  func readableColumn(_ width: CGFloat) -> some View {
    modifier(ReadableColumn(width: width))
  }
}

private struct ReadableColumn: ViewModifier {
  let width: CGFloat

  @State private var available: CGFloat = 0

  func body(content: Content) -> some View {
    content
      .safeAreaPadding(.horizontal, max(0, (available - width) / 2))
      .onGeometryChange(for: CGFloat.self) {
        $0.size.width
      } action: {
        available = $0
      }
  }
}
