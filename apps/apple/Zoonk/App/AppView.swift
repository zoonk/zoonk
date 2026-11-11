import SwiftUI

struct AppView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(PushNotifications.self) private var notifications
  @Environment(SessionStore.self) private var session
  @Environment(StudyRemindersStore.self) private var reminders
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
      .task(id: session.authenticatedSession) {
        if session.authenticatedSession != nil {
          await reminders.refreshPhoneToken()
        }
      }
      .onChange(of: scenePhase, initial: true) { _, scenePhase in
        reconcileSessionOnReturn(scenePhase)

        if scenePhase == .active {
          Task {
            await notifications.clearDeliveredReminders()
          }
        }
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
    imageLoader: .live(),
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
