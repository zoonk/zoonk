import SwiftUI

extension View {
  /// Moves a custom bar or floating control to the trailing side of the fold while iPhone Duo is
  /// partially folded like a book, as the system does with alerts, so no button sits in the crease.
  /// Flat and on every other device it stays where it is. For controls outside a `PaneSplit` pane,
  /// such as a one-column screen's `safeAreaBar(edge: .bottom)`; the control takes the full width
  /// it's offered. System sheets, alerts, menus and toolbars move by themselves.
  func keepsOffFold() -> some View {
    modifier(FoldDisplacement())
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
