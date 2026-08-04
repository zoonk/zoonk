import SwiftUI

@main
struct ZoonkApp: App {
  var body: some Scene {
    WindowGroup {
      AppView()
    }

    #if os(macOS)
      Settings {
        SettingsView()
      }
    #endif
  }
}
