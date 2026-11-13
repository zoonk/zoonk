import SwiftUI

extension View {
  /// The screen frame for a page that heads itself with `PageHeader`: it names the page for the next
  /// page's Back, VoiceOver and the iPad and iPhone Duo bars, and the bar shows the name once the
  /// header's title scrolls away. The bar stays inline, since a large title would repeat the
  /// heading; the system draws Back with the previous page's name, and nothing sets room over the
  /// title.
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
    // The system's own title, taken out of the bar while the header shows it. A stand-in item in
    // the title's place, even an invisible one, takes the room the system Back uses for the
    // previous page's name.
    content
      .navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .toolbar(removing: isHeroShown ? .title : nil)
      .environment(\.isHeroTitleShown, $isHeroShown)
  }
}

private struct HeroTitleVisibility: ViewModifier {
  @Environment(\.isHeroTitleShown) private var isShown

  func body(content: Content) -> some View {
    content.onScrollVisibilityChange { isShown.wrappedValue = $0 }
  }
}
