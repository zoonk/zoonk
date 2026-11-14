#if DEBUG
  import SwiftUI

  /// `ZOONK_DEBUG_LINK` opens an app path as a link to it would (`/learn/{id}`,
  /// `/conversation/{id}`, `/start/{goalId}`), since the simulator sends a local universal link to
  /// Safari. The link is also a launch argument (`-ZOONK_DEBUG_LINK /start/{goalId}`), which device
  /// tools can pass.
  /// `ZOONK_DEBUG_SIGN_IN_EMAIL` and `ZOONK_DEBUG_SIGN_IN_CODE` (a code from the local mailbox)
  /// sign in first. The link waits for that sign-in, since switching from a restored account
  /// closes every task the previous one had open.
  struct DebugLaunch: ViewModifier {
    @Environment(AppRouter.self) private var router
    @Environment(SessionStore.self) private var session
    @State private var signInFinished = false
    @State private var didOpen = false

    private let environment = ProcessInfo.processInfo.environment

    func body(content: Content) -> some View {
      content
        .task {
          if let email = environment["ZOONK_DEBUG_SIGN_IN_EMAIL"],
            let code = environment["ZOONK_DEBUG_SIGN_IN_CODE"]
          {
            await session.signInWithEmailCode(email: email, code: code)
          }

          signInFinished = true
        }
        .onChange(of: signInFinished && session.authenticatedSession != nil, initial: true) {
          _, isReady in
          if isReady, !didOpen,
            let path = environment["ZOONK_DEBUG_LINK"]
              ?? UserDefaults.standard.string(forKey: "ZOONK_DEBUG_LINK"),
            let url = URL(string: "https://zoonk.com\(path)")
          {
            didOpen = true
            router.open(url: url)
          }
        }
    }
  }
#endif
