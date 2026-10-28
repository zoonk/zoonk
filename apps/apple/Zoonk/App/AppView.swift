import SwiftUI

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions

  var body: some View {
    AppTabView()
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
    .environment(AppRouter())
}
