import SwiftUI

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @State private var coursesScope = CoursesScope.all
  @State private var isAccountPresented: Bool
  @State private var navigationPaths: [AppSection: NavigationPath] = [:]
  @State private var selectedSection = AppSection.home

  init(initiallyPresentsAccount: Bool = false) {
    _isAccountPresented = State(initialValue: initiallyPresentsAccount)
  }

  var body: some View {
    TabView(selection: $selectedSection) {
      ForEach(AppSection.allCases) { section in
        Tab(value: section) {
          NavigationStack(path: navigationPath(for: section)) {
            section.tabContent(
              actions: AppSectionActions(
                coursesScope: $coursesScope,
                presentAccount: { isAccountPresented = true },
                selectSection: { selectedSection = $0 })
            )
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
      AccountSheet(openMyCourses: showMyCourses)
    }
    .task {
      await session.restore()
    }
    .task {
      await subscriptions.observeTransactionUpdates(
        synchronizationScope: { session.account?.user.id },
        synchronize: { signedTransaction, expectedAccountID in
          await session.synchronizeAppleSubscription(
            signedTransaction: signedTransaction,
            expectedAccountID: expectedAccountID)
        })
    }
    .task(id: session.account?.user.id) {
      guard session.account != nil else {
        return
      }

      await subscriptions.reconcileCurrentEntitlements(
        synchronizationScope: session.account?.user.id
      ) { signedTransaction, expectedAccountID in
        await session.synchronizeAppleSubscription(
          signedTransaction: signedTransaction,
          expectedAccountID: expectedAccountID)
      }
    }
    .onChange(of: scenePhase) { _, scenePhase in
      reconcileSessionWhenActive(scenePhase)
    }
    .onChange(of: session.authenticatedSession) { previousSession, currentSession in
      guard previousSession != nil, currentSession == nil else {
        return
      }

      navigationPaths[.progress] = NavigationPath()
    }
  }

  private var accountToolbarItem: some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
      accountButton
    }
    .sharedBackgroundVisibility(.hidden)
  }

  private var accountButton: some View {
    AccountToolbarButton {
      isAccountPresented = true
    }
  }

  private func navigationPath(for section: AppSection) -> Binding<NavigationPath> {
    Binding(
      get: { navigationPaths[section] ?? NavigationPath() },
      set: { navigationPaths[section] = $0 })
  }

  private func showMyCourses() {
    navigationPaths[.courses] = NavigationPath()
    coursesScope = .mine
    selectedSection = .courses
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
  let dependencies = AppDependencies(
    clients: .live(baseURL: AppConfiguration.current.apiBaseURL),
    session: .preview(),
    privateImageLoader: .live(),
    subscriptionStore: .live())

  AppView()
    .environment(dependencies.courseCatalogStore)
    .environment(dependencies.learnerSummaryStore)
    .environment(dependencies.myCoursesStore)
    .environment(dependencies.progressStore)
    .environment(dependencies.sessionStore)
    .environment(dependencies.subscriptionStore)
}
