/// Writes a learner made on purpose, such as a plan change: each goes out in its turn, in the order
/// made, and finishes even when the screen that made it goes away, so closing a screen never loses
/// what was tapped. A caller canceled meanwhile, its screen gone, gets `.obsolete`: the write is
/// saved, and the screen shows and opens nothing of it.
@MainActor
final class LearnerSaves {
  private let cache: AppCache
  private var tail: Task<Void, Never>?

  init(cache: AppCache) {
    self.cache = cache
  }

  func save<Value: Sendable>(
    _ write: @escaping @MainActor () async -> MutationResult<Value>
  ) async -> MutationResult<Value> {
    let owner = cache.session.authenticatedSession
    let previous = tail
    let turn = Task { () -> MutationResult<Value> in
      await previous?.value

      // A learner who signed out meanwhile took their changes with them.
      guard cache.session.authenticatedSession == owner else {
        return .obsolete
      }

      return await write()
    }
    tail = Task { _ = await turn.value }

    let result = await turn.value
    return Task.isCancelled ? .obsolete : result
  }
}
