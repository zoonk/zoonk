import SwiftUI

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @State private var wasInBackground = false

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
        reconcileSessionOnReturn(scenePhase)
      }
  }

  /// iCloud Keychain brings sign-ins and sign-outs from the learner's other Apple devices. Launch's
  /// first activation skips this: `restore()` just read the Keychain.
  private func reconcileSessionOnReturn(_ scenePhase: ScenePhase) {
    switch scenePhase {
    case .background:
      wasInBackground = true
    case .active where wasInBackground:
      wasInBackground = false

      Task {
        await session.reconcileSynchronizedCredential()
      }
    default:
      break
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
    .environment(dependencies.progressStore)
    .environment(dependencies.sessionStore)
    .environment(dependencies.settingsStore)
    .environment(dependencies.studySessionStore)
    .environment(dependencies.subscriptionStore)
    .environment(dependencies.todayStore)
    .environment(AppRouter())
}
