import SwiftUI

/// A scroll view whose content, when it fills the height, is at least as tall as the scroll view,
/// so a part that waits at its bottom (a word bank) sits there and holds still while what's above it
/// grows.
struct FillingScrollView<Content: View>: View {
  var fillsHeight = false
  @ViewBuilder let content: Content

  @State private var visibleHeight: CGFloat?

  var body: some View {
    ScrollView {
      content
        .frame(minHeight: fillsHeight ? visibleHeight : nil, alignment: .top)
    }
    .onScrollGeometryChange(for: CGFloat.self, of: \.containerSize.height) { _, height in
      visibleHeight = height
    }
  }
}
