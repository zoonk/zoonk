import SwiftUI

/// Main's `HorizontalScroll`: what can be wider than its room, such as a table or a program, scrolls
/// sideways, and a cut edge fades out, so the learner sees there's more. Content narrower than the
/// room fills it. The leading fade begins `leadingInset` in, past a column that stays put while the
/// rest scrolls under it, such as a program's line numbers.
struct HorizontalScroll<Content: View>: View {
  var leadingInset: CGFloat = 0
  @ViewBuilder let content: Content

  @State private var visibleWidth: CGFloat = 0
  @State private var cut = Cut()

  private struct Cut: Equatable {
    var leading = false
    var trailing = false
  }

  private static var fade: CGFloat { 64 }

  var body: some View {
    ScrollView(.horizontal) {
      content
        .frame(minWidth: visibleWidth, alignment: .leading)
    }
    .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
    .onScrollGeometryChange(for: CGFloat.self) {
      $0.containerSize.width
    } action: {
      visibleWidth = $1
    }
    .onScrollGeometryChange(for: Cut.self) { geometry in
      let offset = geometry.contentOffset.x + geometry.contentInsets.leading
      return Cut(
        leading: offset > 1,
        trailing: offset + geometry.containerSize.width < geometry.contentSize.width - 1)
    } action: {
      cut = $1
    }
    .mask {
      HStack(spacing: 0) {
        Rectangle()
          .frame(width: cut.leading ? leadingInset : 0)
        LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
          .frame(width: cut.leading ? Self.fade : 0)
        Rectangle()
        LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: cut.trailing ? Self.fade : 0)
      }
    }
  }
}
