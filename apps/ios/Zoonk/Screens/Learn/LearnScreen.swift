import SwiftUI

struct LearnScreen: View {
    var body: some View {
        NavigationStack {
            ScreenLayout(title: AppTab.learn.title) {
                EmptyStateView(
                    title: AppTab.learn.emptyStateTitle,
                    description: AppTab.learn.emptyStateDescription,
                    symbolName: AppTab.learn.symbolName
                )
            }
        }
    }
}
