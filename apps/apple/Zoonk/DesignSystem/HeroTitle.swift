import SwiftUI

extension View {
  /// A page that heads itself with its own title: the bar names it once that title scrolls away.
  func barTitleAfterHero(_ title: String) -> some View {
    modifier(BarTitleAfterHero(title: title))
  }

  /// The hero's title, which tells the bar when it leaves the screen.
  func heroTitle() -> some View {
    modifier(HeroTitleVisibility())
  }
}

extension EnvironmentValues {
  @Entry fileprivate var heroTitleShown: (Bool) -> Void = { _ in }
}

private struct BarTitleAfterHero: ViewModifier {
  let title: String

  @State private var isHeroShown = true

  func body(content: Content) -> some View {
    content
      .toolbar(removing: .title)
      .toolbar {
        ToolbarItem(placement: .principal) {
          Text(title)
            .font(.headline)
            .lineLimit(1)
            .opacity(isHeroShown ? 0 : 1)
            .accessibilityHidden(isHeroShown)
        }
      }
      .environment(\.heroTitleShown) { isHeroShown = $0 }
  }
}

private struct HeroTitleVisibility: ViewModifier {
  @Environment(\.heroTitleShown) private var shown

  func body(content: Content) -> some View {
    content.onScrollVisibilityChange { shown($0) }
  }
}
