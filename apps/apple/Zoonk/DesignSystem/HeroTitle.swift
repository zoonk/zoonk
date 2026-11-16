import SwiftUI

extension View {
  /// The screen frame for a page that heads itself with `PageHeader`: it names the page for the next
  /// page's Back, VoiceOver and the iPad and iPhone Duo bars, and the bar shows the name once the
  /// header's title scrolls away. The bar stays inline, since a large title would repeat the
  /// heading; the system draws Back with the previous page's name, and nothing sets room over the
  /// title. While the page has nothing to list (it loads, it's empty, it failed, a gate stands in
  /// its place) the frame draws the header itself, so the title keeps its place in every state.
  func barTitleAfterHero(_ title: String) -> some View {
    modifier(BarTitleAfterHero(title: title))
  }

  /// The hero's title, which tells the bar when it leaves the screen.
  func heroTitle() -> some View {
    modifier(HeroTitleVisibility())
      .headsPage()
  }

  /// What's inside heads the page itself, so `barTitleAfterHero(_:)` adds no header.
  func headsPage() -> some View {
    transformPreference(PageHeadKey.self) { $0.headsItself = true }
  }

  /// The page's one supporting line while a gate stands in its place, drawn under the title the
  /// frame keeps (`barTitleAfterHero(_:)`).
  @ViewBuilder
  func described(by description: LocalizedStringResource?) -> some View {
    if let description {
      transformPreference(PageHeadKey.self) { $0.line = String(localized: description) }
    } else {
      self
    }
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
      .backgroundPreferenceValue(PageHeadKey.self) { head in
        if !head.headsItself {
          ZoonkList {
            Section {
              PageHeader(Text(title), supporting: head.line.map { Text($0) })
            }
          }
          .scrollDisabled(true)
          .scrollContentBackground(.hidden)
          .lonePage()
        }
      }
      .navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .toolbar(removing: isHeroShown ? .title : nil)
      .environment(\.isHeroTitleShown, $isHeroShown)
  }
}

private struct PageHead: Equatable {
  var headsItself = false
  var line: String?
}

private struct PageHeadKey: PreferenceKey {
  static let defaultValue = PageHead()

  static func reduce(value: inout PageHead, nextValue: () -> PageHead) {
    let next = nextValue()
    value.headsItself = value.headsItself || next.headsItself
    value.line = value.line ?? next.line
  }
}

private struct HeroTitleVisibility: ViewModifier {
  @Environment(\.isHeroTitleShown) private var isShown

  func body(content: Content) -> some View {
    content.onScrollVisibilityChange { isShown.wrappedValue = $0 }
  }
}
