import SwiftUI

@main
struct ZoonkApp: App {
  @State private var session: SessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  private let initiallyPresentsAccount: Bool

  init() {
    #if DEBUG
      if let configuration = UITestConfiguration.current {
        _session = State(initialValue: configuration.session)
        _subscriptions = State(initialValue: .live())
        initiallyPresentsAccount = configuration.initiallyPresentsAccount
        return
      }
    #endif

    let dependencies = AppDependencies.live()
    _session = State(initialValue: dependencies.sessionStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
    initiallyPresentsAccount = false
  }

  var body: some Scene {
    WindowGroup {
      AppView(initiallyPresentsAccount: initiallyPresentsAccount)
        .environment(session)
        .environment(subscriptions)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
