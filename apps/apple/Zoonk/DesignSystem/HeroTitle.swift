import SwiftUI

extension View {
  /// A page that heads itself with its own title: the bar names it once that title scrolls away.
  /// The bar stays inline, since a large title would repeat the heading above it.
  func barTitleAfterHero(_ title: String) -> some View {
    modifier(BarTitleAfterHero(title: title))
  }

  /// The hero's title, which tells the bar when it leaves the screen.
  func heroTitle() -> some View {
    modifier(HeroTitleVisibility())
  }

  /// Names the bar of a page its content heads, for VoiceOver and the next page's Back, without
  /// showing the name in it.
  func barName(_ title: Text) -> some View {
    navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .toolbar(removing: .title)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var isHeroTitleShown: Binding<Bool> = .constant(true)
}

private struct BarTitleAfterHero: ViewModifier {
  let title: String

  @State private var isHeroShown = true

  func body(content: Content) -> some View {
    content
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        // The principal item stands in for the title, which `toolbar(removing: .title)` would take
        // with it.
        ToolbarItem(placement: .principal) {
          Text(title)
            .font(.headline)
            .lineLimit(1)
            .opacity(isHeroShown ? 0 : 1)
            .accessibilityHidden(isHeroShown)
        }
      }
      .environment(\.isHeroTitleShown, $isHeroShown)
  }
}

private struct HeroTitleVisibility: ViewModifier {
  @Environment(\.isHeroTitleShown) private var isShown

  func body(content: Content) -> some View {
    content.onScrollVisibilityChange { isShown.wrappedValue = $0 }
  }
}
