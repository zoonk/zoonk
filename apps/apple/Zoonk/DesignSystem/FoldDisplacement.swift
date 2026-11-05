import SwiftUI

extension View {
  /// For controls outside a `PaneSplit` pane; the control takes the full width it's offered. System
  /// sheets, alerts, menus and toolbars move by themselves.
  func keepsOffFold() -> some View {
    modifier(FoldDisplacement())
  }

  /// For a block of a one-column screen that reads with what's above it, such as a control and the
  /// words under it: on iPhone Duo it stays on the page before the hinge, flat or folded,
  /// leading-aligned.
  func keepsBeforeHinge() -> some View {
    modifier(HingeEnd())
  }

  /// For a whole screen with nothing to face, such as a status, a gate or one decision: on iPhone
  /// Duo it keeps to the page before the hinge, flat or folded, and the page after it stays blank
  /// under the same background. Elsewhere it's at most `readableWidth` wide, in the middle.
  func lonePage(readableWidth: CGFloat = .infinity) -> some View {
    modifier(LonePage(readableWidth: readableWidth))
  }
}

extension View {
  /// What each helper here measures, outside its own padding. A frame with only a maximum width grows
  /// to fit content its padding pushed past the width offered and moves the fold the helper reads, so
  /// the helpers would measure each other forever; with both bounds it keeps the width offered:
  /// https://developer.apple.com/documentation/swiftui/view/frame(minwidth:idealwidth:maxwidth:minheight:idealheight:maxheight:alignment:)
  fileprivate func atOfferedWidth() -> some View {
    frame(minWidth: 0, maxWidth: .infinity)
  }
}

private struct FoldDisplacement: ViewModifier {
  @State private var fold: ClosedRange<CGFloat>?

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity)
      .padding(.leading, fold?.upperBound ?? 0)
      .atOfferedWidth()
      .onGeometryChange(for: ClosedRange<CGFloat>?.self) {
        PaneSpace($0).fold
      } action: {
        fold = $0
      }
  }
}

private struct HingeEnd: ViewModifier {
  @State private var space = PaneSpace(width: 0)

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.trailing, space.hinge.map { space.width - $0.lowerBound } ?? 0)
      .atOfferedWidth()
      .onGeometryChange(for: PaneSpace.self, of: PaneSpace.init) { space = $0 }
  }
}

private struct LonePage: ViewModifier {
  let readableWidth: CGFloat

  @State private var space = PaneSpace(width: 0)

  func body(content: Content) -> some View {
    content
      .readableColumn(space.hinge == nil ? readableWidth : .infinity)
      .safeAreaPadding(.trailing, space.lonePageInset)
      .atOfferedWidth()
      .onGeometryChange(for: PaneSpace.self, of: PaneSpace.init) { space = $0 }
  }
}
