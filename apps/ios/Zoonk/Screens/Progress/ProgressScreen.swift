import SwiftUI

struct ProgressScreen: View {
    var body: some View {
        NavigationStack {
            ScreenLayout(title: AppTab.progress.title) {
                EmptyStateView(
                    title: AppTab.progress.emptyStateTitle,
                    description: AppTab.progress.emptyStateDescription,
                    symbolName: AppTab.progress.symbolName
                )
            }
        }
    }
}
