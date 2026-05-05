import SwiftUI

struct AppShell: View {
    @State private var selectedTab = AppTab.home

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab(AppTab.home.title, systemImage: AppTab.home.symbolName, value: AppTab.home) {
                HomeScreen()
            }

            Tab(AppTab.learn.title, systemImage: AppTab.learn.symbolName, value: AppTab.learn) {
                LearnScreen()
            }

            Tab(AppTab.progress.title, systemImage: AppTab.progress.symbolName, value: AppTab.progress) {
                ProgressScreen()
            }

            Tab(AppTab.search.title, systemImage: AppTab.search.symbolName, value: AppTab.search, role: .search) {
                SearchScreen()
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}
