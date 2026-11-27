import Foundation
import Observation

/// Something a learner saves to come back to, with what a list shows of it before it's read again.
protocol Saveable: Equatable, Sendable {
  associatedtype Key: Hashable & Sendable

  var key: Key { get }
}

/// A learner's saves of one kind (maps, lessons), shown at once. Taps faster than the saves end in
/// the last one asked for; a failure goes back to what the last read says and says so. Not
/// `QueuedSaves`: the server takes the state wanted, so only each one's last tap is sent, and a save
/// can be made where no list of saves was read, such as the lesson player.
@MainActor
@Observable
final class Saves<Target: Saveable> {
  struct Pending: Hashable, Sendable {
    let session: AuthenticatedSession
    let key: Target.Key
  }

  struct Failure: Equatable, Sendable {
    let goalId: String
    let key: Target.Key
    /// What the learner asked for: a save, or taking one away.
    let saved: Bool
    let session: AuthenticatedSession
  }

  typealias Write =
    @Sendable (
      _ token: String, _ goalId: String, _ key: Target.Key, _ saved: Bool
    ) async throws -> Bool

  /// What each learner asked for while it saves: shown at once, and dropped once the save is done
  /// or failed, when the reads say again.
  private(set) var pending: [Pending: Bool] = [:]
  private(set) var failure: Failure?

  /// Shows a save the server took in every copy read so far, so dropping its pending tap changes
  /// nothing shown.
  @ObservationIgnored var show:
    @MainActor (_ target: Target, _ saved: Bool, _ goalId: String) -> Void =
      { _, _, _ in }

  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let domains: Set<DataDomain>
  @ObservationIgnored private let write: Write

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

  func set(_ saved: Bool, _ target: Target, goalId: String) {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    let pending = Pending(session: session, key: target.key)
    let isSaving = self.pending[pending] != nil
    self.pending[pending] = saved

    if failure?.key == target.key {
      failure = nil
    }

    guard !isSaving else {
      return
    }

    Task {
      await save(pending, target: target, goalId: goalId)
    }
  }

  /// A failure over the screens of the goal that tried, hidden once the session it was made for
  /// changes.
  func failure(goalId: String) -> Failure? {
    guard let failure, failure.goalId == goalId,
      failure.session == cache.session.authenticatedSession
    else {
      return nil
    }

    return failure
  }

  func dismissFailure() {
    failure = nil
  }

  private func save(_ pending: Pending, target: Target, goalId: String) async {
    var sent: Bool?

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
        failure = Failure(goalId: goalId, key: pending.key, saved: wanted, session: pending.session)
      case .obsolete:
        self.pending[pending] = nil
        return
      }
    }

    self.pending[pending] = nil

    // A save the server took is the learner's wherever it's listed, a later tap's failure included.
    if sent != nil {
      cache.invalidate(domains)
    }
  }
}
