import Foundation

enum MutationResult<Value: Sendable>: Sendable {
  case done(Value)
  /// Say so and undo what the write showed.
  case failed(APIError)
  /// The session changed or the write was cancelled meanwhile: change nothing, since another
  /// learner's data may be on screen.
  case obsolete
}

extension AppCache {
  /// Signs the session out on `unauthorized` and invalidates `domains` once the write succeeds. A
  /// write whose session changed or whose task was cancelled comes back `.obsolete` and does neither.
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
