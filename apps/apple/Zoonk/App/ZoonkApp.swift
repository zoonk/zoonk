import SwiftUI

@main
struct ZoonkApp: App {
  @State private var courseCatalog: CourseCatalogStore
  @State private var progress: ProgressStore
  @State private var session: SessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  private let initiallyPresentsAccount: Bool

  init() {
    #if DEBUG
      if let configuration = UITestConfiguration.current {
        _courseCatalog = State(initialValue: configuration.courseCatalog)
        _progress = State(initialValue: configuration.progress)
        _session = State(initialValue: configuration.session)
        _subscriptions = State(initialValue: .live())
        initiallyPresentsAccount = configuration.initiallyPresentsAccount
        return
      }
    #endif

    let dependencies = AppDependencies.live()
    _courseCatalog = State(initialValue: dependencies.courseCatalogStore)
    _progress = State(initialValue: dependencies.progressStore)
    _session = State(initialValue: dependencies.sessionStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
    initiallyPresentsAccount = false
  }

  var body: some Scene {
    WindowGroup {
      AppView(initiallyPresentsAccount: initiallyPresentsAccount)
        .environment(courseCatalog)
        .environment(progress)
        .environment(session)
        .environment(subscriptions)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
