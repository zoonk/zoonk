import Foundation
import Observation

/// Asks the plan about the choice on screen, again every few seconds while the plan isn't ready, and
/// keeps each answer, so going back to an earlier choice asks nothing new. Each ask plans the goal, so
/// one is out at a time, as main's request lane: a choice made while one is out waits for it to settle
/// and is asked only if it's still the one on screen, so days changed meanwhile ask once, for the
/// latest week.
@MainActor
@Observable
final class PlanAsking<Key: Hashable & Sendable, Answer: PlanAnswer> {
  enum Status: Equatable, Sendable {
    case idle
    case asking
    /// An ask that went unanswered too long (it keeps asking), three failures in a row, or a plan
    /// that stayed unready too long: `restart` asks again.
    case failed
  }

  private(set) var answers: [Key: Answer] = [:]
  private(set) var first: Answer?
  private(set) var status = Status.idle
  /// Changes on `restart`, so a task keyed by it asks again.
  private(set) var round = 0
  private var latest: Answer?

  @ObservationIgnored private var out: (key: Key, id: UUID, answer: Task<Answer, Error>)?
  @ObservationIgnored private let interval: Duration
  @ObservationIgnored private let settle: Duration
  @ObservationIgnored private let patience: Duration
  @ObservationIgnored private let timeout: Duration

  /// After the first answer, `settle` lets days tapped in a row or a menu passing times ask once.
  /// `timeout` is main's: an ask unanswered that long fails while its request keeps the lane.
  init(
    interval: Duration = .seconds(3),
    settle: Duration = .milliseconds(300),
    patience: Duration = .seconds(600),
    timeout: Duration = .seconds(45)
  ) {
    self.interval = interval
    self.settle = settle
    self.patience = patience
    self.timeout = timeout
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
  func ask(
    _ key: Key, when enabled: Bool, _ request: @escaping @MainActor () async throws -> Answer
  ) async {
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
        guard let next = try await send(key, request) else {
          guard !Task.isCancelled else {
            return
          }

          status = .failed
          throw TimedOut()
        }

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

  /// Nil once the ask was cancelled (another choice is on screen) or went unanswered for `timeout`,
  /// waiting for the lane included; the request it sent runs on and holds the lane until it settles.
  private func send(_ key: Key, _ request: @escaping @MainActor () async throws -> Answer)
    async throws -> Answer?
  {
    let deadline = ContinuousClock.now + timeout

    while let out, out.key != key {
      guard await settled(out.answer, before: deadline) != nil, !Task.isCancelled else {
        return nil
      }
    }

    return try await settled(out?.answer ?? lane(key, request), before: deadline)?.get()
  }

  /// Stops waiting at `deadline` or on cancellation; `task` itself runs on.
  private func settled(_ task: Task<Answer, Error>, before deadline: ContinuousClock.Instant)
    async -> Result<Answer, Error>?
  {
    let gate = Gate<Result<Answer, Error>?>()

    return await withTaskCancellationHandler {
      await withCheckedContinuation { continuation in
        gate.open(continuation)
        gate.watch(Task { gate.resume(await task.result) })
        gate.watch(
          Task {
            try? await Task.sleep(until: deadline)
            gate.resume(nil)
          })
      }
    } onCancel: {
      Task { @MainActor in gate.resume(nil) }
    }
  }

  private func lane(_ key: Key, _ request: @escaping @MainActor () async throws -> Answer)
    -> Task<Answer, Error>
  {
    let id = UUID()

    let sent = Task {
      defer {
        if out?.id == id {
          out = nil
        }
      }

      return try await request()
    }

    out = (key, id, sent)
    return sent
  }
}

private struct TimedOut: Error {}

/// Resumes once, with whichever comes first.
@MainActor
private final class Gate<Value: Sendable> {
  private var continuation: CheckedContinuation<Value, Never>?
  private var watchers: [Task<Void, Never>] = []

  func open(_ continuation: CheckedContinuation<Value, Never>) {
    self.continuation = continuation
  }

  func watch(_ task: Task<Void, Never>) {
    watchers.append(task)
  }

  func resume(_ value: Value) {
    guard let continuation else {
      return
    }

    self.continuation = nil
    for watcher in watchers {
      watcher.cancel()
    }

    continuation.resume(returning: value)
  }
}
