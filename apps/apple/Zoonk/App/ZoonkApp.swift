import SwiftUI

@main
struct ZoonkApp: App {
  @State private var session: SessionStore
  private let initiallyPresentsAccount: Bool

  init() {
    #if DEBUG
      if let configuration = UITestConfiguration.current {
        _session = State(initialValue: configuration.session)
        initiallyPresentsAccount = configuration.initiallyPresentsAccount
        return
      }
    #endif

    _session = State(initialValue: AppDependencies.live().sessionStore)
    initiallyPresentsAccount = false
  }

  var body: some Scene {
    WindowGroup {
      AppView(initiallyPresentsAccount: initiallyPresentsAccount)
        .environment(session)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
