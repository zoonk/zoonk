import SwiftUI

extension View {
  /// A bar over the screen's content. Like the system's bars, its controls' text stops growing at
  /// the second accessibility size, so at the largest sizes it leaves the screen to the content.
  func screenBar(edge: VerticalEdge, @ViewBuilder content: () -> some View) -> some View {
    modifier(ScreenBar(edge: edge, bar: content()))
  }

  /// A field in a screen bar keeps the learner's text size: they read what they type.
  func keepsFullTextSize() -> some View {
    modifier(FullTextSize())
  }
}

extension EnvironmentValues {
  @Entry var screenTextSize: DynamicTypeSize?
}

private struct ScreenBar<Bar: View>: ViewModifier {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let edge: VerticalEdge
  let bar: Bar

  func body(content: Content) -> some View {
    content.safeAreaBar(edge: edge) {
      bar
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .environment(\.screenTextSize, dynamicTypeSize)
    }
  }
}

private struct FullTextSize: ViewModifier {
  @Environment(\.screenTextSize) private var screenTextSize
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  func body(content: Content) -> some View {
    content.dynamicTypeSize(screenTextSize ?? dynamicTypeSize)
  }
}
