#if DEBUG
  import SwiftUI

  /// Opens the lesson on `ZOONK_DEBUG_LESSON_ID` once a session is restored, so a lesson from the
  /// local database (such as one holding every activity template) can be played on a simulator
  /// without tapping through the app. `ZOONK_DEBUG_SIGN_IN_EMAIL` and `ZOONK_DEBUG_SIGN_IN_CODE` (a
  /// code from the local mailbox) sign in first; the lesson waits for that sign-in, since switching
  /// from a restored account closes every task the previous one had open.
  struct DebugLessonLaunch: ViewModifier {
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
          if isReady, !didOpen, let lessonId = environment["ZOONK_DEBUG_LESSON_ID"] {
            didOpen = true
            router.open(.lesson(lessonId: lessonId))
          }
        }
    }
  }
#endif
