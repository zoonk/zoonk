import SwiftUI

extension View {
  /// Loads the resources a screen shows the way every screen should: cached data at once, a
  /// request only when nothing is cached or it's stale (on appear and on returning to the
  /// foreground), pull to refresh, and a revalidation when a mutation invalidates it while it's
  /// on screen. Frame data that isn't a screen's content passes `refreshable: false`, so pull to
  /// refresh stays with the screens.
  func loads(_ resources: any CachedResource..., refreshable: Bool = true) -> some View {
    modifier(ResourceLoading(resources: resources, refreshable: refreshable))
  }
}

private struct ResourceLoading: ViewModifier {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(SessionStore.self) private var session

  let resources: [any CachedResource]
  let refreshable: Bool

  @ViewBuilder
  func body(content: Content) -> some View {
    if refreshable {
      loading(content).refreshable {
        await forEach(resources) { await $0.refresh() }
      }
    } else {
      loading(content)
    }
  }

  private func loading(_ content: Content) -> some View {
    content
      .task(id: ResourceLoadingID(resources: resources, session: session.authenticatedSession)) {
        for resource in resources {
          resource.beginViewing()
        }

        defer {
          for resource in resources {
            resource.endViewing()
          }
        }

        await forEach(resources) { await $0.load() }
        await untilCancelled()
      }
      .onChange(of: scenePhase) { _, scenePhase in
        guard scenePhase == .active else {
          return
        }

        Task {
          await forEach(resources) { await $0.load() }
        }
      }
  }
}

/// Restarts loading when the screen shows other resources or another session signs in.
private struct ResourceLoadingID: Equatable {
  let resources: [ObjectIdentifier]
  let session: AuthenticatedSession?

  init(resources: [any CachedResource], session: AuthenticatedSession?) {
    self.resources = resources.map { ObjectIdentifier($0) }
    self.session = session
  }
}

/// Runs the resources' requests side by side.
@MainActor
private func forEach(
  _ resources: [any CachedResource],
  _ operation: @escaping @MainActor @Sendable (any CachedResource) async -> Void
) async {
  await withTaskGroup(of: Void.self) { group in
    for resource in resources {
      group.addTask { await operation(resource) }
    }
  }
}

/// Keeps the view's task, and with it the resources' viewing count, alive until SwiftUI cancels
/// it when the view disappears or shows other resources.
private func untilCancelled() async {
  try? await Task.sleep(for: .seconds(60 * 60 * 24 * 365))
}
