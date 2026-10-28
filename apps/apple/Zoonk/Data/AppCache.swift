import Foundation

/// The app's cache of server data, created once in the composition root. Feature stores create
/// their resources here; a mutation tells it which domains it changed so every resource reading
/// one of them revalidates, and a session change drops everything the previous session loaded.
@MainActor
final class AppCache {
  /// How long a loaded value counts as fresh. Mutations and `nextChangeAt` revalidate sooner;
  /// this catches changes made elsewhere, such as on another device.
  static let defaultMaxAge = Duration.seconds(5 * 60)

  let session: SessionStore
  private let now: () -> ContinuousClock.Instant
  private var resources: [WeakResource] = []

  init(
    session: SessionStore,
    now: @escaping () -> ContinuousClock.Instant = { ContinuousClock.now }
  ) {
    self.session = session
    self.now = now
  }

  /// Creates a resource and registers it for invalidation and session changes.
  ///
  /// - Parameters:
  ///   - audience: whose data it is, which decides what a session change does to it.
  ///   - domains: the data it reads that mutations can change.
  ///   - isEmpty: whether a loaded value has nothing to show; a fetch returning nil is empty too.
  ///   - fetch: one request for the value, given the session it's for (nil when signed out).
  func resource<Value: Equatable & Sendable>(
    audience: ResourceAudience,
    domains: Set<DataDomain> = [],
    maxAge: Duration = defaultMaxAge,
    isEmpty: @escaping (Value) -> Bool = { _ in false },
    fetch: @escaping Resource<Value>.Fetch
  ) -> Resource<Value> {
    let resource = Resource(
      audience: audience,
      domains: domains,
      maxAge: maxAge,
      now: now,
      session: session,
      isEmpty: isEmpty,
      fetch: fetch)
    resources.removeAll { $0.resource == nil }
    resources.append(WeakResource(resource: resource))
    return resource
  }

  /// Revalidates every resource that reads one of the domains a mutation changed: on screen now,
  /// elsewhere the next time it's shown. Call it after a successful write with everything the
  /// write changed, the way main revalidates the matching cache tags.
  func invalidate(_ domains: Set<DataDomain>) {
    for resource in liveResources where !resource.domains.isDisjoint(with: domains) {
      resource.invalidate()
    }
  }

  /// Drops every resource that belongs to a session that's no longer current. The composition
  /// root calls it when the session changes, so signing out frees the previous learner's data.
  func followSession() {
    for resource in liveResources {
      resource.followSession()
    }
  }

  private var liveResources: [any CachedResource] {
    resources.compactMap(\.resource)
  }
}

/// Feature stores own their resources; the cache only reaches the ones still in use.
private struct WeakResource {
  weak var resource: (any CachedResource)?
}
