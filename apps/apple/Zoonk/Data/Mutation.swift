import Foundation

/// What a write made for one session came to.
enum MutationResult<Value: Sendable>: Sendable {
  case done(Value)
  /// The write failed for the session that's still current: say so and undo what it showed.
  case failed(APIError)
  /// The session that made the write ended or changed meanwhile, or the write was cancelled.
  /// Nothing on screen belongs to it anymore, so change nothing: no rollback, no message.
  case obsolete
}

extension AppCache {
  /// Runs a write for the current session: it captures the full session identity, sends that
  /// identity's token, signs that identity out on `unauthorized`, and once the write succeeds
  /// invalidates `domains`, the data it changed. A result for an identity that's no longer current
  /// comes back `.obsolete`, so it's never published or rolled back onto another learner's data.
  /// So does a write whose task was cancelled (its screen closed): it neither invalidates nor signs
  /// out. Callers still own their action task and cancel it when its screen goes away.
  func mutate<Value: Sendable>(
    invalidating domains: Set<DataDomain> = [],
    _ write: (AuthenticatedSession) async throws -> Value
  ) async -> MutationResult<Value> {
    guard !Task.isCancelled, let identity = session.authenticatedSession else {
      return .obsolete
    }

    do {
      let value = try await write(identity)

      guard !Task.isCancelled, session.authenticatedSession == identity else {
        return .obsolete
      }

      invalidate(domains)
      return .done(value)
    } catch {
      let error = apiError(from: error)

      guard !Task.isCancelled else {
        return .obsolete
      }

      if error as? APIError == .unauthorized {
        await session.expire(identity)
      }

      guard session.authenticatedSession == identity, let failure = error as? APIError,
        failure != .unauthorized
      else {
        return .obsolete
      }

      return .failed(failure)
    }
  }
}
