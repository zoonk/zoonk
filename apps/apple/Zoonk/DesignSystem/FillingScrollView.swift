import SwiftUI

/// A scroll view whose content, when it fills the height, is at least as tall as the scroll view,
/// so a part that waits at its bottom (a word bank) sits there and holds still while what's above it
/// grows.
struct FillingScrollView<Content: View>: View {
  var fillsHeight = false
  @ViewBuilder let content: Content

  @State private var visibleHeight: CGFloat?

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        content
          .frame(minHeight: fillsHeight ? visibleHeight : nil, alignment: .top)
      }
      .onScrollGeometryChange(for: CGFloat.self, of: \.containerSize.height) { _, height in
        visibleHeight = height
      }
      .environment(\.scrollIntoView, ScrollIntoView(proxy: proxy))
    }
  }
}

/// Brings a view of the scroll view around it into sight, as little as it can, gliding unless
/// motion is reduced.
struct ScrollIntoView {
  fileprivate let proxy: ScrollViewProxy?

  @MainActor
  func callAsFunction(_ id: some Hashable, reduceMotion: Bool) {
    withAnimation(reduceMotion ? nil : .default) {
      proxy?.scrollTo(id)
    }
  }
}

extension EnvironmentValues {
  @Entry var scrollIntoView = ScrollIntoView(proxy: nil)
}

extension View {
  /// Scrolls into sight as it shows, such as a verdict that arrives below the fold or under the
  /// bottom bar.
  func scrollsIntoSightWhenShown() -> some View {
    modifier(ScrollsIntoSightWhenShown())
  }
}

private struct ScrollsIntoSightWhenShown: ViewModifier {
  @Environment(\.scrollIntoView) private var scrollIntoView
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var id = UUID()

  func body(content: Content) -> some View {
    content
      // What's brought into sight reaches main's 16 past each edge, so it never ends on one.
      .background {
        Color.clear
          .padding(.vertical, -16)
          .id(id)
      }
      // After it's laid out, so the scroll view knows where it is.
      .task { scrollIntoView(id, reduceMotion: reduceMotion) }
  }
}
