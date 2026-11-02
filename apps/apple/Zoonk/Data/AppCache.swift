import Foundation

@MainActor
final class AppCache {
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
    session.subscriptionChanged = { [weak self] in
      self?.invalidate([.allowance, .userSubscription])
    }
  }

  /// A fetch returning nil is empty too.
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

  func invalidate(_ domains: Set<DataDomain>) {
    for resource in liveResources where !resource.domains.isDisjoint(with: domains) {
      resource.invalidate()
    }
  }

  func followSession() {
    for resource in liveResources {
      resource.followSession()
    }
  }

  private var liveResources: [any CachedResource] {
    resources.compactMap(\.resource)
  }
}

private struct WeakResource {
  weak var resource: (any CachedResource)?
}
