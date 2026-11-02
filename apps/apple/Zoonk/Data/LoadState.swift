/// `.loading` is only the first load: revalidating keeps `.loaded` or `.empty`, and a failed
/// refresh keeps the content.
enum LoadState<Value: Equatable & Sendable>: Equatable, Sendable {
  case idle
  case loading
  case loaded(Value)
  case empty
  case failed(APIError)

  var hasContent: Bool {
    switch self {
    case .loaded, .empty:
      true
    case .idle, .loading, .failed:
      false
    }
  }
}

/// Mirrors main's cache tags in `packages/core/src/cache/tags.ts`.
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

enum ResourceAudience: Sendable {
  /// Kept across sessions.
  case everyone
  /// Public but personalized for a signed-in reader, so dropped when the session changes.
  case viewer
  /// Idle while signed out; dropped when the session changes.
  case signedIn
}
