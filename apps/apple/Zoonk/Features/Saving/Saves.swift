import Foundation
import Observation

/// Something a learner saves to come back to, with what a list shows of it before it's read again.
protocol Saveable: Equatable, Sendable {
  associatedtype Key: Hashable & Sendable

  var key: Key { get }
}

/// A learner's saves of one kind (maps, lessons), shown at once. Taps faster than the saves end in
/// the last one asked for; a failure goes back to what the last read says, and the screen that asked
/// says so through its `SaveVisit`. Not `QueuedSaves`: the server takes the state wanted, so only
/// each one's last tap is sent, and a save can be made where no list of saves was read, such as the
/// lesson player.
@MainActor
@Observable
final class Saves<Target: Saveable> {
  struct Pending: Hashable, Sendable {
    let session: AuthenticatedSession
    let key: Target.Key
  }

  struct Failure: Equatable, Sendable {
    /// What the learner asked for: a save, or taking one away.
    let saved: Bool
  }

  typealias Write =
    @Sendable (
      _ token: String, _ goalId: String, _ key: Target.Key, _ saved: Bool
    ) async throws -> Bool

  /// What each learner asked for while it saves: shown at once, and dropped once the save is done
  /// or failed, when the reads say again.
  private(set) var pending: [Pending: Bool] = [:]

  /// Shows a save the server took in every copy read so far, so dropping its pending tap changes
  /// nothing shown.
  @ObservationIgnored var show:
    @MainActor (_ target: Target, _ saved: Bool, _ goalId: String) -> Void =
      { _, _, _ in }

  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let domains: Set<DataDomain>
  @ObservationIgnored private let write: Write
  /// Each one's writes while they're sent, which every tap made meanwhile waits for.
  @ObservationIgnored private var sending: [Pending: Task<Failure?, Never>] = [:]

  /// `domains` are read again once the server took a save: what lists the saves, in an order only
  /// the server knows.
  init(cache: AppCache, invalidating domains: Set<DataDomain>, write: @escaping Write) {
    self.cache = cache
    self.domains = domains
    self.write = write
  }

  /// `server` is what the last read says.
  func isSaved(_ key: Target.Key, server: Bool) -> Bool {
    guard let session = cache.session.authenticatedSession else {
      return server
    }

    return pending[Pending(session: session, key: key)] ?? server
  }

  /// Shows `saved` at once and sends it, after the write on its way when there is one. The write
  /// returned ends with the last tap's: what failed, or nil once the server took it or the session
  /// changed. It goes on whoever stops waiting for it.
  @discardableResult
  func set(_ saved: Bool, _ target: Target, goalId: String) -> Task<Failure?, Never>? {
    guard let session = cache.session.authenticatedSession else {
      return nil
    }

    let pending = Pending(session: session, key: target.key)
    self.pending[pending] = saved

    if let write = sending[pending] {
      return write
    }

    let write = Task { await save(pending, target: target, goalId: goalId) }
    sending[pending] = write
    return write
  }

  private func save(_ pending: Pending, target: Target, goalId: String) async -> Failure? {
    var sent: Bool?
    var failure: Failure?

    while let wanted = self.pending[pending], wanted != sent {
      let write = write
      let result: MutationResult<Bool> =
        cache.session.authenticatedSession == pending.session
        ? await cache.mutate { identity in
          try await write(identity.bearerToken, goalId, pending.key, wanted)
        } : .obsolete

      switch result {
      case .done(let saved):
        sent = saved
        show(target, saved, goalId)
      case .failed:
        self.pending[pending] = nil
        failure = Failure(saved: wanted)
      case .obsolete:
        self.pending[pending] = nil
        sending[pending] = nil
        return nil
      }
    }

    self.pending[pending] = nil
    sending[pending] = nil

    // A save the server took is the learner's wherever it's listed, a later tap's failure included.
    if sent != nil {
      cache.invalidate(domains)
    }

    return failure
  }
}

/// The saves one visit to a screen asked for, and how the last one that failed ended, for as long
/// as the visit lasts. The screen keeps it in `@State` (`lessonSaveVisit()`, `mindMapSaveVisit()`)
/// and leaves it as it goes away: the writes still out go on in `Saves`, but say nothing here, and
/// the next visit starts clean. Each thing saved is followed on its own, so a tap on one row never
/// hides another's failure.
@MainActor
@Observable
final class SaveVisit<Target: Saveable> {
  var failure: Saves<Target>.Failure?
  @ObservationIgnored private var following: [Target.Key: Task<Void, Never>] = [:]

  func set(_ saved: Bool, _ target: Target, goalId: String, in saves: Saves<Target>) {
    guard let write = saves.set(saved, target, goalId: goalId) else {
      return
    }

    following[target.key]?.cancel()
    following[target.key] = Task {
      let ended = await write.value

      guard !Task.isCancelled else {
        return
      }

      following[target.key] = nil

      if let ended {
        failure = ended
      }
    }
  }

  func leave() {
    for task in following.values {
      task.cancel()
    }

    following = [:]
    failure = nil
  }
}
