import Foundation

@MainActor
final class AppCache {
  static let defaultMaxAge = Duration.seconds(5 * 60)

  let session: SessionStore
  private let now: () -> ContinuousClock.Instant
  private var resources: [WeakResource] = []
  /// Every window follows the same change.
  private var followedSession: AuthenticatedSession?

  init(
    session: SessionStore,
    now: @escaping () -> ContinuousClock.Instant = { ContinuousClock.now }
  ) {
    self.session = session
    self.now = now
    followedSession = session.authenticatedSession
    session.subscriptionChanged = { [weak self] in
      self?.invalidate([.allowance, .userSubscription])
    }
    // Main expires the session's tag on a rename: certificates and the buddy say the name.
    session.nameChanged = { [weak self] in
      self?.invalidate([.userSession])
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

  /// Public reads of the session's domain stay on screen and revalidate: a guest who signs into an
  /// account moves their certificates to it, under its name.
  func followSession() {
    guard followedSession != session.authenticatedSession else {
      return
    }

    followedSession = session.authenticatedSession

    for resource in liveResources {
      resource.followSession()

      if resource.audience == .everyone, resource.domains.contains(.userSession) {
        resource.invalidate()
      }
    }
  }

  private var liveResources: [any CachedResource] {
    resources.compactMap(\.resource)
  }
}

private struct WeakResource {
  weak var resource: (any CachedResource)?
}
