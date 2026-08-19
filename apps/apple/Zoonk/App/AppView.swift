import SwiftUI

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @State private var isAccountPresented: Bool
  @State private var selectedSection = AppSection.home

  init(initiallyPresentsAccount: Bool = false) {
    _isAccountPresented = State(initialValue: initiallyPresentsAccount)
  }

  var body: some View {
    TabView(selection: $selectedSection) {
      ForEach(AppSection.allCases) { section in
        Tab(value: section, role: section.tabRole) {
          NavigationStack {
            section.tabContent
              .navigationTitle(Text(section.title))
              .toolbarTitleDisplayMode(.inlineLarge)
              .modifier(AdaptiveNavigationTitle())
              .toolbar {
                accountToolbarItem
              }
          }
        } label: {
          Label {
            Text(section.tabTitle)
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
    .task {
      await subscriptions.observeTransactionUpdates(
        synchronizationScope: { session.account?.user.id },
        synchronize: { signedTransaction in
          await session.synchronizeAppleSubscription(signedTransaction: signedTransaction)
        })
    }
    .task(id: session.account?.user.id) {
      guard session.account != nil else {
        return
      }

      await subscriptions.reconcileCurrentEntitlements(
        synchronizationScope: session.account?.user.id
      ) { signedTransaction in
        await session.synchronizeAppleSubscription(signedTransaction: signedTransaction)
      }
    }
    .onChange(of: scenePhase) { _, scenePhase in
      reconcileSessionWhenActive(scenePhase)
    }
  }

  @ToolbarContentBuilder
  private var accountToolbarItem: some ToolbarContent {
    if #available(iOS 26.0, *) {
      ToolbarItem(placement: .topBarTrailing) {
        accountButton
      }
      .sharedBackgroundVisibility(.hidden)
    } else {
      ToolbarItem(placement: .topBarTrailing) {
        accountButton
      }
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
}

private struct AdaptiveNavigationTitle: ViewModifier {
  @Environment(\.tabBarPlacement) private var tabBarPlacement

  func body(content: Content) -> some View {
    content.toolbar(removing: tabBarPlacement == .topBar ? .title : nil)
  }
}

#Preview {
  AppView()
    .environment(SessionStore.preview())
    .environment(AppStoreSubscriptionStore.live())
}
