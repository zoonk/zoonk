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

  func body(content: Content) -> some View {
    // A reader, so the column fits the width in the same layout pass. A width kept in state
    // re-padded the list a pass later, and two nested columns (a lone page around a list) did that
    // to each other forever while an iPad rotated.
    GeometryReader { proxy in
      let room = max(0, proxy.size.width - width)

      content
        .safeAreaPadding(.leading, alignment == .leading ? 0 : room / 2)
        .safeAreaPadding(.trailing, alignment == .leading ? room : room / 2)
    }
  }
}
