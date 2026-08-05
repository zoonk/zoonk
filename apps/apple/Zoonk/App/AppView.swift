import SwiftUI

struct AppView: View {
  @State private var selectedSection = AppSection.home

  var body: some View {
    TabView(selection: $selectedSection) {
      ForEach(AppSection.allCases) { section in
        Tab(value: section, role: section.tabRole) {
          NavigationStack {
            section.tabContent
              .navigationTitle(section.title)
          }
        } label: {
          Label {
            Text(section.title)
          } icon: {
            Image(systemName: section.systemImage)
          }
        }
      }
    }
    .tabViewStyle(.sidebarAdaptable)
  }
}

#Preview {
  AppView()
}
