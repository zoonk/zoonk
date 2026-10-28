import Foundation
import Observation

/// Sends a running mock's answers one after another, so an older answer to a question never lands
/// after a newer one and none is dropped: a request that couldn't reach the server is tried again
/// with growing waits (or at once with `retryNow`) before anything after it. A newer answer to a
/// question still waiting replaces the older one, since each holds everything about its question.
/// A refused save isn't tried again: nothing would change.
@MainActor
@Observable
final class MockDraftQueue {
  /// Every answer stored, some on their way, some waiting to go out again after a request that
  /// couldn't reach the server, or one the server turned down (until a later one is stored).
  enum Status: Equatable {
    case saved
    case saving
    case retrying
    case refused
  }

  /// What sending one answer came to: stored, refused, or it didn't get through.
  enum Outcome: Sendable {
    case stored
    case refused
    case unreachable
  }

  private(set) var status: Status = .saved

  @ObservationIgnored private let save: (MockDraft) async -> Outcome
  @ObservationIgnored private let retryDelay: (Int) -> Duration
  @ObservationIgnored private var waiting: [MockDraft] = []
  @ObservationIgnored private var sending = false
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var refused = false
  @ObservationIgnored private var retryTask: Task<Void, Never>?

  /// - Parameter retryDelay: the wait before a new try after `attempt` failed ones: 1 s, doubling
  ///   up to 15 s.
  init(
    retryDelay: @escaping (Int) -> Duration = { attempt in
      .seconds(min(1 << min(attempt, 4), 15))
    },
    save: @escaping (MockDraft) async -> Outcome
  ) {
    self.retryDelay = retryDelay
    self.save = save
  }

  /// Whether an answer is still waiting or on its way.
  var isBusy: Bool { sending || !waiting.isEmpty }

  /// Sends an answer after the ones before it, replacing one to its question still waiting.
  func add(_ draft: MockDraft) {
    if let index = waiting.firstIndex(where: { $0.itemId == draft.itemId }) {
      waiting[index] = draft
    } else {
      waiting.append(draft)
    }

    sendNext()
  }

  /// Returns once every answer given so far is stored or refused, or the waiting task is cancelled.
  func idle() async {
    while isBusy, !Task.isCancelled {
      try? await Task.sleep(for: .milliseconds(50))
    }
  }

  /// Tries the waiting answers again now (the learner asked to).
  func retryNow() {
    guard let retryTask else {
      return
    }

    retryTask.cancel()
    self.retryTask = nil
    sendNext()
  }

  /// Stops retrying when the screen goes away; what wasn't sent stays unsent.
  func stop() {
    retryTask?.cancel()
    retryTask = nil
    waiting.removeAll()
    settle()
  }

  private func sendNext() {
    guard !sending, retryTask == nil, !waiting.isEmpty else {
      settle()
      return
    }

    let draft = waiting.removeFirst()
    sending = true
    settle()

    Task {
      let outcome = await save(draft)
      sending = false

      switch outcome {
      case .unreachable:
        // Keep it first in line, unless a newer answer to its question replaced it meanwhile.
        if !waiting.contains(where: { $0.itemId == draft.itemId }) {
          waiting.insert(draft, at: 0)
        }

        scheduleRetry()
        settle()
      case .stored, .refused:
        attempt = 0
        refused = outcome == .refused
        sendNext()
      }
    }
  }

  private func scheduleRetry() {
    let delay = retryDelay(attempt)
    attempt += 1

    retryTask = Task {
      try? await Task.sleep(for: delay)

      guard !Task.isCancelled else {
        return
      }

      retryTask = nil
      sendNext()
    }
  }

  private func settle() {
    if retryTask != nil {
      status = .retrying
    } else if isBusy {
      status = .saving
    } else {
      status = refused ? .refused : .saved
    }
  }
}
