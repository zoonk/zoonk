import SwiftUI

extension View {
  /// For controls outside a `PaneSplit` pane; the control takes the full width it's offered. System
  /// sheets, alerts, menus and toolbars move by themselves.
  func keepsOffFold() -> some View {
    modifier(FoldDisplacement())
  }

  /// For a block of a one-column screen that reads with what's above it, such as a control and the
  /// words under it: partially folded, it stays on the page before the fold, leading-aligned.
  func keepsBeforeFold() -> some View {
    modifier(FoldEnd())
  }
}

private struct FoldDisplacement: ViewModifier {
  @State private var fold: ClosedRange<CGFloat>?

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity)
      .padding(.leading, fold?.upperBound ?? 0)
      // Measured outside the padding, so moving the control doesn't move the fold it reads.
      .onGeometryChange(for: ClosedRange<CGFloat>?.self) {
        PaneSpace($0).fold
      } action: {
        fold = $0
      }
  }
}

private struct FoldEnd: ViewModifier {
  @State private var space = PaneSpace(width: 0)

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.trailing, space.fold.map { space.width - $0.lowerBound } ?? 0)
      // Measured outside the padding, so ending the block doesn't move the fold it reads.
      .onGeometryChange(for: PaneSpace.self, of: PaneSpace.init) { space = $0 }
  }
}
