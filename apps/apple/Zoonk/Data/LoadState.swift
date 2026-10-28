/// What a screen shows for one cached resource. `.loading` is only the first load: once a value
/// is shown, revalidating keeps `.loaded` or `.empty` and a failed refresh keeps the content.
enum LoadState<Value: Equatable & Sendable>: Equatable, Sendable {
  case idle
  case loading
  case loaded(Value)
  case empty
  case failed(APIError)

  /// Whether the resource has something to show, so a refresh must keep it on screen.
  var hasContent: Bool {
    switch self {
    case .loaded, .empty:
      true
    case .idle, .loading, .failed:
      false
    }
  }
}

/// Data a mutation can change, named like main's cache tags (`packages/core/src/cache/tags.ts`).
/// A resource lists the domains it reads; after a write, `AppCache.invalidate(_:)` revalidates
/// every resource that reads a changed domain.
enum DataDomain: Hashable, Sendable {
  case allowance
  case goals
  case learnerModel
  case learningProfile
  case memory
  case userProgress
  case userSession
  case userSubscription
}

/// Whose data a resource holds, which decides what a session change does to it.
enum ResourceAudience: Sendable {
  /// Public data that doesn't depend on who reads it, such as the catalog. Kept across sessions.
  case everyone
  /// Public data that a signed-in reader sees personalized, such as a course with its progress.
  /// Dropped when the session changes.
  case viewer
  /// The signed-in learner's own data. Idle while signed out, dropped when the session changes.
  case signedIn
}
