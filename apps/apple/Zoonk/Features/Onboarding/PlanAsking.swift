import Foundation
import Observation

/// Asks the plan about the choice on screen, again every few seconds while the plan isn't ready, and
/// keeps each answer, so going back to an earlier choice asks nothing new.
@MainActor
@Observable
final class PlanAsking<Key: Hashable & Sendable, Answer: PlanAnswer> {
  enum Status: Equatable, Sendable {
    case idle
    case asking
    /// Three failures in a row, or a plan that stayed unready too long: `restart` asks again.
    case failed
  }

  private(set) var answers: [Key: Answer] = [:]
  private(set) var first: Answer?
  private(set) var status = Status.idle
  /// Changes on `restart`, so a task keyed by it asks again.
  private(set) var round = 0
  private var latest: Answer?

  @ObservationIgnored private let interval: Duration
  @ObservationIgnored private let settle: Duration
  @ObservationIgnored private let patience: Duration

  /// After the first answer, `settle` lets days tapped in a row or a menu passing times ask once.
  init(
    interval: Duration = .seconds(3),
    settle: Duration = .milliseconds(300),
    patience: Duration = .seconds(600)
  ) {
    self.interval = interval
    self.settle = settle
    self.patience = patience
  }

  /// The ready answer for `key`.
  func answer(for key: Key) -> Answer? {
    answers[key].flatMap { $0.ready ? $0 : nil }
  }

  /// The answer for `key`, else the last one that came, only while it's ready: an unready answer says
  /// nothing about the goal.
  func last(for key: Key) -> Answer? {
    (answers[key] ?? latest).flatMap { $0.ready ? $0 : nil }
  }

  func restart() {
    round += 1
  }

  /// Returns once the answer is ready, the asking fails, or the task is cancelled; an answer that comes
  /// after cancellation is dropped.
  func ask(_ key: Key, when enabled: Bool, _ request: () async throws -> Answer) async {
    guard enabled, answers[key]?.ready != true else {
      status = .idle
      return
    }

    status = .asking

    if latest != nil {
      do {
        try await Task.sleep(for: settle)
      } catch {
        return
      }
    }

    let start = ContinuousClock.now
    var failures = 0

    while true {
      do {
        let next = try await request()
        try Task.checkCancellation()
        answers[key] = next
        latest = next
        failures = 0

        if next.ready {
          first = first ?? next
          status = .idle
          return
        }
      } catch {
        guard !(error is CancellationError), !Task.isCancelled else {
          return
        }

        failures += 1
      }

      if failures == 3 || ContinuousClock.now - start >= patience {
        status = .failed
        return
      }

      do {
        try await Task.sleep(for: interval)
      } catch {
        return
      }
    }
  }
}
