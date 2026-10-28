import SwiftUI

extension View {
  /// Loads the resources a screen shows the way every screen should: cached data at once, a
  /// request only when nothing is cached or it's stale (on appear and on returning to the
  /// foreground), pull to refresh, and a revalidation when a mutation invalidates it while it's
  /// on screen. A failed request isn't asked again as the screen redraws, only by those. Frame
  /// data that isn't a screen's content passes `refreshable: false`, so pull to refresh stays
  /// with the screens.
  func loads(_ resources: any CachedResource..., refreshable: Bool = true) -> some View {
    modifier(ResourceLoading(resources: resources, refreshable: refreshable))
  }
}

extension EnvironmentValues {
  /// Whether a full-screen task covers this screen. A covered screen doesn't count as showing its
  /// resources: a mutation made in the task marks them stale instead of refetching them behind it,
  /// and they revalidate once when the task closes. It only loads what it has nothing of yet, so a
  /// screen opened under a task is ready when uncovered. The shell sets it from its stack of tasks.
  @Entry var isCoveredByTask = false
}

private struct ResourceLoading: ViewModifier {
  @Environment(\.isCoveredByTask) private var isCovered
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
      .task(
        id: ResourceLoadingID(
          resources: resources, session: session.authenticatedSession, isCovered: isCovered)
      ) {
        guard !isCovered else {
          await forEach(resources) { await $0.prepare() }
          return
        }

        for resource in resources {
          resource.beginViewing()
        }

        defer {
          for resource in resources {
            resource.endViewing()
          }
        }

        await forEach(resources) { await $0.show() }
        await untilCancelled()
      }
      .onChange(of: scenePhase) { _, scenePhase in
        guard scenePhase == .active, !isCovered else {
          return
        }

        Task {
          await forEach(resources) { await $0.load() }
        }
      }
  }
}

/// Restarts loading when the screen shows other resources, another session signs in, or a task
/// covers or uncovers it.
private struct ResourceLoadingID: Equatable {
  let resources: [ObjectIdentifier]
  let session: AuthenticatedSession?
  let isCovered: Bool

  init(resources: [any CachedResource], session: AuthenticatedSession?, isCovered: Bool) {
    self.resources = resources.map { ObjectIdentifier($0) }
    self.session = session
    self.isCovered = isCovered
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
