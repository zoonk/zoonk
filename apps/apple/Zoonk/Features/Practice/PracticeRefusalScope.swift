import SwiftUI

extension View {
  /// A refused write was about the account and plan at the time, so signing up, getting Plus or
  /// switching accounts clears it.
  func clearsRefusal(_ clear: @escaping () -> Void) -> some View {
    modifier(RefusalScope(clear: clear))
  }
}

private struct RefusalScope: ViewModifier {
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var learner
  let clear: () -> Void

  func body(content: Content) -> some View {
    content
      .onChange(of: session.authenticatedSession) { clear() }
      .onChange(of: session.account?.account.subscription) { clear() }
      .onChange(of: learner.summary.value?.tier) { clear() }
  }
}
