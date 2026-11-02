import SwiftUI

extension View {
  /// Frame data that isn't a screen's content passes `refreshable: false`, so pull to refresh stays
  /// with the screens.
  func loads(_ resources: any CachedResource..., refreshable: Bool = true) -> some View {
    modifier(ResourceLoading(resources: resources, refreshable: refreshable))
  }
}

extension EnvironmentValues {
  /// A covered screen doesn't count as showing its resources: a mutation made in the task marks
  /// them stale instead of refetching them behind it, and they revalidate once the task closes.
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

/// Holds the resources' viewing count until SwiftUI cancels the view's task.
private func untilCancelled() async {
  try? await Task.sleep(for: .seconds(60 * 60 * 24 * 365))
}
