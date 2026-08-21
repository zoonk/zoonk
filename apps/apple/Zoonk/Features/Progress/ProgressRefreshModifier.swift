import SwiftUI

private struct ProgressRefreshModifier: ViewModifier {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session

  let refresh: @MainActor () async -> Void

  func body(content: Content) -> some View {
    content
      .task(id: session.authenticatedSession) {
        guard scenePhase == .active else {
          return
        }

        await refresh()
      }
      .onChange(of: scenePhase) { _, newScenePhase in
        guard newScenePhase == .active else {
          return
        }

        Task {
          await refresh()
        }
      }
      .refreshable {
        await refresh()
      }
  }
}

extension View {
  func refreshesProgress(
    _ refresh: @escaping @MainActor () async -> Void
  ) -> some View {
    modifier(ProgressRefreshModifier(refresh: refresh))
  }
}
