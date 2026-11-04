import SwiftUI

extension View {
  /// Keeps a list's sections the page margin inside the safe area, where `pageBar(_:)` puts its
  /// controls. On its own a list keeps the larger of the safe area and its margin, so beside the outer
  /// display's side bar or at a hinge its sections wouldn't line up with a bar under them.
  func pageMargins() -> some View {
    modifier(PageMargins())
  }

  /// A bottom bar whose controls line up with the sections of the lists under it that keep
  /// `pageMargins()`, kept off the fold.
  func pageBar<Bar: View>(@ViewBuilder _ bar: () -> Bar) -> some View {
    safeAreaBar(edge: .bottom) {
      bar()
        .padding(.horizontal, pageMargin)
        .keepsOffFold()
        .scenePadding(.vertical)
    }
  }
}

private let pageMargin: CGFloat = 16

private struct PageMargins: ViewModifier {
  func body(content: Content) -> some View {
    // A reader, so the margins take the safe area in the same layout pass: the sections never move.
    GeometryReader { proxy in
      content
        // A list's content margins count from its whole bounds, which run under the safe area.
        .contentMargins(.leading, proxy.safeAreaInsets.leading + pageMargin, for: .scrollContent)
        .contentMargins(.trailing, proxy.safeAreaInsets.trailing + pageMargin, for: .scrollContent)
    }
  }
}
