import Foundation
import Observation

/// What `AppCache` and the `loads(_:)` modifier need from a resource, whatever its value type.
@MainActor
protocol CachedResource: AnyObject, Sendable {
  var audience: ResourceAudience { get }
  var domains: Set<DataDomain> { get }
  func load() async
  func show() async
  func refresh() async
  func invalidate()
  func followSession()
  func beginViewing()
  func endViewing()
}

/// One piece of server data a screen shows, kept for the app's lifetime so returning to a screen
/// or a tab shows it at once. It loads once, revalidates in the background when it's older than
/// `maxAge` or a mutation invalidated it, shares one request among every caller, keeps what's
/// shown while revalidating, and belongs to the session that loaded it: another session never
/// sees it, and an expired session leads to sign-in instead of a stuck screen.
///
/// Create resources with `AppCache.resource(audience:domains:maxAge:isEmpty:fetch:)` and show them
/// with `loads(_:)`.
@MainActor
@Observable
final class Resource<Value: Equatable & Sendable>: CachedResource {
  typealias Fetch = (AuthenticatedSession?) async throws -> Value?

  /// True while a request runs for content that's already shown.
  private(set) var isRefreshing = false
  private var storedState = LoadState<Value>.idle

  let audience: ResourceAudience
  let domains: Set<DataDomain>

  /// Changes whenever the shown value is replaced or dropped, so work that started from one value,
  /// such as loading its next page, can tell that value is gone before applying its result.
  @ObservationIgnored private(set) var revision = 0

  @ObservationIgnored private let fetch: Fetch
  @ObservationIgnored private let isEmpty: (Value) -> Bool
  @ObservationIgnored private let maxAge: Duration
  @ObservationIgnored private let now: () -> ContinuousClock.Instant
  @ObservationIgnored private let session: SessionStore
  @ObservationIgnored private var isInvalidated = false
  /// The last request failed and nothing has asked again since. A screen redrawn over the error,
  /// or over the content a failed refresh kept, doesn't fetch again on its own, so a failure that
  /// persists (a 5xx, a response the app can't decode) can't loop.
  @ObservationIgnored private var hasSettledOnFailure = false
  @ObservationIgnored private var loadedAt: ContinuousClock.Instant?
  @ObservationIgnored private var owner: AuthenticatedSession?
  @ObservationIgnored private var request: (id: Int, task: Task<Void, Never>)?
  @ObservationIgnored private var requestCount = 0
  @ObservationIgnored private var viewers = 0

  init(
    audience: ResourceAudience,
    domains: Set<DataDomain>,
    maxAge: Duration,
    now: @escaping () -> ContinuousClock.Instant,
    session: SessionStore,
    isEmpty: @escaping (Value) -> Bool,
    fetch: @escaping Fetch
  ) {
    self.audience = audience
    self.domains = domains
    self.maxAge = maxAge
    self.now = now
    self.session = session
    self.isEmpty = isEmpty
    self.fetch = fetch
    owner = audience == .everyone ? nil : session.authenticatedSession
  }

  /// What the screen shows. Reading it also follows the session, so a screen never shows another
  /// session's data, not even for the frame before `AppCache` drops it.
  var state: LoadState<Value> {
    // Read before the session check: a screen first drawn while the value is hidden (another
    // session's, or none yet after a restored sign-in) must still redraw once it loads.
    let storedState = storedState

    guard audience == .everyone || owner == session.authenticatedSession else {
      return .idle
    }

    return storedState
  }

  var value: Value? {
    guard case .loaded(let value) = state else {
      return nil
    }

    return value
  }

  /// Shows what's cached at once: loads when nothing is, and revalidates in the background when
  /// the value is stale. A call while a request runs waits for that request instead of starting
  /// another.
  func load() async {
    followSession()

    guard canRequest, !storedState.hasContent || isStale else {
      return
    }

    await run()
  }

  /// What a screen showing the resource asks for (`loads(_:)`): `load()`, except that after a
  /// failed request it waits for a retry, pull to refresh, the app's return to the foreground or
  /// an invalidation instead of asking again each time the screen redraws.
  func show() async {
    followSession()

    guard !hasSettledOnFailure else {
      return
    }

    await load()
  }

  /// Fetches again now while keeping what's shown, as pull to refresh and retry do.
  func refresh() async {
    followSession()

    guard canRequest else {
      return
    }

    await run()
  }

  /// Marks the value out of date after a mutation changed it. A screen showing it revalidates now,
  /// a failed load included; otherwise it revalidates the next time a screen loads it. A response
  /// already on its way may predate the mutation, so it's discarded.
  func invalidate() {
    isInvalidated = true
    hasSettledOnFailure = false

    guard request != nil || storedState != .idle else {
      return
    }

    cancelRequest()

    guard viewers > 0, canRequest else {
      return
    }

    Task {
      await run()
    }
  }

  /// Replaces the shown value with one derived from it, such as a list with its next page appended
  /// or the result a mutation returned. Does nothing when no value is shown.
  func update(_ transform: (Value) -> Value) {
    guard case .loaded(let value) = state else {
      return
    }

    let updated = transform(value)
    storedState = isEmpty(updated) ? .empty : .loaded(updated)
    revision += 1
  }

  /// Drops data that belongs to a session that's no longer current.
  func followSession() {
    guard audience != .everyone, owner != session.authenticatedSession else {
      return
    }

    cancelRequest()
    owner = session.authenticatedSession
    storedState = .idle
    loadedAt = nil
    isInvalidated = false
    hasSettledOnFailure = false
    revision += 1
  }

  func beginViewing() {
    viewers += 1
  }

  func endViewing() {
    viewers -= 1
  }

  /// A signed-in resource waits for a session; the others can always load.
  private var canRequest: Bool {
    audience != .signedIn || owner != nil
  }

  private var isStale: Bool {
    guard !isInvalidated, let loadedAt else {
      return true
    }

    return now() - loadedAt > maxAge
  }

  private func run() async {
    if let request {
      await request.task.value
      return
    }

    requestCount += 1
    let id = requestCount
    let owner = owner
    hasSettledOnFailure = false

    if storedState.hasContent {
      isRefreshing = true
    } else {
      storedState = .loading
    }

    let task = Task {
      let result: Result<Value?, Error>

      do {
        result = .success(try await fetch(owner))
      } catch {
        result = .failure(error)
      }

      await finish((id: id, owner: owner, result: result))
    }

    request = (id: id, task: task)
    await task.value
  }

  private func finish(
    _ response: (id: Int, owner: AuthenticatedSession?, result: Result<Value?, Error>)
  ) async {
    guard request?.id == response.id else {
      return
    }

    request = nil
    isRefreshing = false

    guard audience == .everyone || response.owner == session.authenticatedSession else {
      followSession()
      return
    }

    switch response.result {
    case .success(let value):
      storedState = value.flatMap { isEmpty($0) ? nil : LoadState.loaded($0) } ?? .empty
      loadedAt = now()
      isInvalidated = false
      revision += 1
    case .failure(let error):
      await fail(apiError(from: error), owner: response.owner)
    }
  }

  /// A failed refresh keeps what's shown, except when the data no longer exists. An expired
  /// session signs out, which drops the data and shows sign-in.
  private func fail(_ error: Error, owner: AuthenticatedSession?) async {
    if error is CancellationError {
      if storedState == .loading {
        storedState = .idle
      }

      return
    }

    hasSettledOnFailure = true

    switch error as? APIError ?? .unavailable {
    case .unauthorized:
      storedState = .idle
      revision += 1

      if let owner {
        await session.expire(owner)
      }
    case .notFound:
      storedState = .failed(.notFound)
      revision += 1
    case .network where !storedState.hasContent:
      storedState = .failed(.network)
    case .unavailable where !storedState.hasContent:
      storedState = .failed(.unavailable)
    case .network, .unavailable:
      break
    }
  }

  private func cancelRequest() {
    request?.task.cancel()
    request = nil
    isRefreshing = false

    if storedState == .loading {
      storedState = .idle
    }
  }
}
