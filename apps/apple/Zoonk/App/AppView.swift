import SwiftUI

/// Opens the account surface directly in Debug UI runs so iPhone and iPad UI tests can render account states without relying on prior navigation.
private func shouldPresentAccountForUITesting() -> Bool {
  #if DEBUG
    ProcessInfo.processInfo.arguments.contains("--ui-testing-account-sheet")
  #else
    false
  #endif
}

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session
  @State private var isAccountPresented = shouldPresentAccountForUITesting()
  @State private var selectedSection = AppSection.home

  var body: some View {
    TabView(selection: $selectedSection) {
      ForEach(AppSection.allCases) { section in
        Tab(value: section, role: section.tabRole) {
          NavigationStack {
            sectionRoot(section)
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
    .sheet(isPresented: $isAccountPresented) {
      AccountSheet {
        selectedSection = .courses
      }
    }
    .task {
      await session.restore()
    }
    .onChange(of: scenePhase) { _, scenePhase in
      reconcileSessionWhenActive(scenePhase)
    }
  }

  private var accountButton: some View {
    AccountToolbarButton {
      isAccountPresented = true
    }
  }

  /// Rechecks iCloud Keychain whenever the app returns to the foreground so a login or logout from another Apple device updates this UI without a process restart.
  private func reconcileSessionWhenActive(_ scenePhase: ScenePhase) {
    guard scenePhase == .active else {
      return
    }

    Task {
      await session.reconcileSynchronizedCredential()
    }
  }

  /// Keeps the App Store-style account affordance beside the large screen title on both iPhone and iPad.
  private func sectionRoot(_ section: AppSection) -> some View {
    section.tabContent
      .safeAreaInset(edge: .top, spacing: 0) {
        HStack {
          Text(section.title)
            .font(.largeTitle.bold())
            .accessibilityAddTraits(.isHeader)

          Spacer()

          accountButton
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.background)
      }
  }
}

#Preview {
  AppView()
    .environment(SessionStore.preview())
}
