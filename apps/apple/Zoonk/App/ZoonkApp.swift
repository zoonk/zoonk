import SwiftUI

@main
struct ZoonkApp: App {
  @State private var session = SessionStore.live()

  var body: some Scene {
    WindowGroup {
      AppView()
        .environment(session)
        #if os(iOS) || os(macOS)
          .onOpenURL { url in
            session.handleGoogleSignInURL(url)
          }
        #endif
    }

    #if os(macOS)
      Settings {
        SettingsView()
          .environment(session)
      }
    #endif
  }
}
