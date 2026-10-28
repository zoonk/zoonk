import Foundation
import Observation

@MainActor
protocol CachedResource: AnyObject, Sendable {
  var audience: ResourceAudience { get }
  var domains: Set<DataDomain> { get }
  func load() async
  func show() async
  func prepare() async
  func refresh() async
  func invalidate()
  func followSession()
  func beginViewing()
  func endViewing()
}

@MainActor
@Observable
final class Resource<Value: Equatable & Sendable>: CachedResource {
  typealias Fetch = (AuthenticatedSession?) async throws -> Value?

  /// Only for content that's already shown; a first load is `.loading`.
  private(set) var isRefreshing = false
  private var storedState = LoadState<Value>.idle

  let audience: ResourceAudience
  let domains: Set<DataDomain>

  /// Changes whenever the shown value is replaced or dropped, so work that started from one value,
  /// such as loading its next page, can tell it's gone.
  @ObservationIgnored private(set) var revision = 0

  @ObservationIgnored private let fetch: Fetch
  @ObservationIgnored private let isEmpty: (Value) -> Bool
  @ObservationIgnored private let maxAge: Duration
  @ObservationIgnored private let now: () -> ContinuousClock.Instant
  @ObservationIgnored private let session: SessionStore
  @ObservationIgnored private var isInvalidated = false
  /// Keeps a persistent failure (a 5xx, an undecodable response) from refetching on every redraw.
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

  /// Reading it follows the session, so a screen never shows another session's data, not even for
  /// the frame before `AppCache` drops it.
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

  /// A call while a request runs waits for that request instead of starting another.
  func load() async {
    followSession()

    guard canRequest, !storedState.hasContent || isStale else {
      return
    }

    await run()
  }

  /// `load()`, except that after a failed request it waits for a retry, pull to refresh, the
  /// foreground or an invalidation instead of asking again each time the screen redraws.
  func show() async {
    followSession()

    guard !hasSettledOnFailure else {
      return
    }

    await load()
  }

  /// For a screen a task covers: loads only when nothing is there yet, so it's ready once
  /// uncovered. What's already there waits, stale or not, for the screen to be shown again.
  func prepare() async {
    followSession()

    guard canRequest, !storedState.hasContent, !hasSettledOnFailure else {
      return
    }

    await run()
  }

  func refresh() async {
    followSession()

    guard canRequest else {
      return
    }

    await run()
  }

  /// A screen showing it revalidates now, a failed load included; otherwise the next time a screen
  /// loads it. A response already on its way may predate the mutation, so it's discarded.
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

  /// Does nothing when no value is shown.
  func update(_ transform: (Value) -> Value) {
    guard case .loaded(let value) = state else {
      return
    }

    let updated = transform(value)
    storedState = isEmpty(updated) ? .empty : .loaded(updated)
    revision += 1
  }

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
