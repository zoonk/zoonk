import SwiftUI

struct SearchScreen: View {
    @State private var searchText = ""
#if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
#endif

    var body: some View {
#if os(iOS)
        if horizontalSizeClass == .compact {
            compactScreen
        } else {
            regularScreen
        }
#else
        regularScreen
#endif
    }

    private var compactScreen: some View {
        ScreenLayout(title: AppTab.search.title) {
            NavigationStack {
                SearchContent(searchText: searchText)
            }
            .searchable(text: $searchText)
        }
    }

    private var regularScreen: some View {
        NavigationStack {
            ScreenLayout(title: AppTab.search.title) {
                SearchContent(searchText: searchText)
            }
        }
        .searchable(text: $searchText)
    }
}

private struct SearchContent: View {
    let searchText: String

    var body: some View {
        if searchText.isEmpty {
            EmptyStateView(
                title: AppTab.search.emptyStateTitle,
                description: AppTab.search.emptyStateDescription,
                symbolName: "book.closed"
            )
        } else {
            ContentUnavailableView.search(text: searchText)
        }
    }
}
