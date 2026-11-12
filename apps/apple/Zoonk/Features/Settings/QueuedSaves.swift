/// The changes a learner makes to one resource faster than they save, as main's actions run. They
/// go to the server one at a time, in the order made, and the resource shows what the server took
/// with the changes still waiting on top, so a change that fails takes back only itself. The
/// resource and what the changes touched are read again once none wait.
@MainActor
final class QueuedSaves<Value: Equatable & Sendable> {
  private struct Change {
    let id: Int
    let owner: AuthenticatedSession?
    let apply: (Value) -> Value
  }

  private let resource: Resource<Value>
  private let cache: AppCache
  /// What the server took from the learner whose changes wait.
  private var saved: (owner: AuthenticatedSession?, value: Value)?
  private var waiting: [Change] = []
  private var changed: Set<DataDomain> = []
  private var lastID = 0
  /// Changes made before the resource was read, still waiting for their turn to read it.
  private var unread = 0
  private var tail: Task<Void, Never>?

  init(_ resource: Resource<Value>, cache: AppCache) {
    self.resource = resource
    self.cache = cache
  }

  /// `confirm` gives what the server took from its reply. A change made before any screen read the
  /// resource reads it first, in its turn, so it keeps its place among the changes made after it.
  /// Nothing is sent when it can't be read (nil), nor once the learner who made the change is gone.
  func save<Reply: Sendable>(
    _ apply: @escaping (Value) -> Value,
    invalidating domains: Set<DataDomain>,
    _ write: @escaping (AuthenticatedSession) async throws -> Reply,
    confirm: @escaping (Value, Reply) -> Value
  ) async -> MutationResult<Reply>? {
    let owner = cache.session.authenticatedSession
    lastID += 1
    let change = Change(id: lastID, owner: owner, apply: apply)
    // It shows on top of the changes made before it, so it waits while one of them waits to read.
    let shown = unread == 0 ? resource.value : nil

    if let shown {
      show(change, over: shown)
    } else {
      unread += 1
    }

    let previous = tail
    let turn = Task { () -> MutationResult<Reply>? in
      await previous?.value

      if shown == nil {
        defer { unread -= 1 }

        if resource.value == nil, cache.session.authenticatedSession == owner {
          await resource.load()
        }

        guard cache.session.authenticatedSession == owner else {
          return .obsolete
        }

        guard let value = resource.value else {
          return nil
        }

        show(change, over: value)
      }

      let result: MutationResult<Reply> =
        cache.session.authenticatedSession == owner ? await cache.mutate(write) : .obsolete

      settle(change, result, invalidating: domains, confirm: confirm)
      return result
    }
    tail = Task { _ = await turn.value }

    guard let result = await turn.value else {
      return nil
    }

    return cache.session.authenticatedSession == owner ? result : .obsolete
  }

  private func show(_ change: Change, over value: Value) {
    if saved?.owner != change.owner || !waiting.contains(where: { $0.owner == change.owner }) {
      saved = (change.owner, value)
    }

    waiting.append(change)
    resource.update(change.apply)
  }

  private func settle<Reply: Sendable>(
    _ change: Change, _ result: MutationResult<Reply>, invalidating domains: Set<DataDomain>,
    confirm: (Value, Reply) -> Value
  ) {
    waiting.removeAll { $0.id == change.id }

    guard let base = saved, base.owner == change.owner else {
      return
    }

    let confirmed: Value

    switch result {
    case .done(let reply):
      confirmed = confirm(base.value, reply)
      changed.formUnion(domains)
    case .failed:
      confirmed = base.value
    case .obsolete:
      waiting.removeAll { $0.owner == change.owner }
      saved = nil
      changed = []
      return
    }

    let left = waiting.filter { $0.owner == change.owner }
    let shown = left.reduce(confirmed) { $1.apply($0) }
    resource.update { _ in shown }

    guard left.isEmpty else {
      saved = (base.owner, confirmed)
      return
    }

    saved = nil
    cache.invalidate(changed.union(resource.domains))
    changed = []
  }
}
