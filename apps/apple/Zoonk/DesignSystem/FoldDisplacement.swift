import SwiftUI

extension View {
  /// For controls outside a `PaneSplit` pane; the control takes the full width it's offered. System
  /// sheets, alerts, menus and toolbars move by themselves.
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
