import SwiftUI

/// A row that opens a page: the list's `NavigationLink`, whose chevron the list draws, or in a
/// grid's block (`PageSection`) a row that opens the same page and draws its own chevron. A grid's
/// blocks share one list row, which a `NavigationLink` inside would turn into a link from edge to
/// edge, so a tap on empty space would open its page.
struct PageLink<Label: View>: View {
  @Environment(\.isGridBlock) private var isGridBlock
  @Environment(AppRouter.self) private var router

  let route: AppRoute
  @ViewBuilder let label: Label

  var body: some View {
    if isGridBlock {
      Button {
        router.open(route)
      } label: {
        label
          .frame(maxWidth: .infinity, alignment: .leading)
          .disclosureChevron()
      }
    } else {
      NavigationLink(value: route) {
        label
      }
    }
  }
}
