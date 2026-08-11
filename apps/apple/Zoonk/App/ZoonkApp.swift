import SwiftUI

@main
struct ZoonkApp: App {
  @State private var session = SessionStore.live()

  var body: some Scene {
    WindowGroup {
      AppView()
        .environment(session)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
