import SwiftUI

struct HomeScreen: View {
    var body: some View {
        NavigationStack {
            ScreenLayout(title: AppTab.home.title) {
                EmptyStateView(
                    title: AppTab.home.emptyStateTitle,
                    description: AppTab.home.emptyStateDescription,
                    symbolName: AppTab.home.symbolName
                )
            }
        }
    }
}
