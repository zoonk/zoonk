import Foundation
import Observation

/// Sends answers one after another, so an older answer to a question never lands after a newer one.
/// A newer answer to a question still waiting replaces the older one, since each holds everything
/// about its question. A refused save isn't tried again: nothing would change, and its question stays
/// unsaved until a later answer to it is stored.
@MainActor
@Observable
final class MockDraftQueue {
  enum Status: Equatable {
    case saved
    case saving
    /// An answer didn't get through and waits to go again; "Try again" sends it now.
    case retrying
    /// An answer that didn't get through is on its way again. Its note stays up, so it isn't drawn
    /// and read out again on every attempt, but there's nothing more to send until it fails.
    case resending
    case refused
  }

  enum Outcome: Sendable {
    case stored
    case refused
    case unreachable
  }

  private(set) var status: Status = .saved
  private var failedDrafts: [String: MockDraft] = [:]
  private var storedDrafts: [String: MockDraft] = [:]

  func countsTowardsProgress(_ draft: MockDraft?, initiallyStored: MockDraft?) -> Bool {
    guard let draft, draft.isAnswered else { return false }
    let stored = storedDrafts[draft.itemId] ?? initiallyStored
    return draft.answer != failedDrafts[draft.itemId]?.answer || draft.answer == stored?.answer
  }

  @ObservationIgnored private let save: (MockDraft) async -> Outcome
  @ObservationIgnored private let retryDelay: (Int) -> Duration
  @ObservationIgnored private var waiting: [MockDraft] = []
  @ObservationIgnored private var sending = false
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var refused: Set<String> = []
  @ObservationIgnored private var retryTask: Task<Void, Never>?
  @ObservationIgnored private var sendTask: Task<Void, Never>?
  @ObservationIgnored private var isStopped = false

  init(
    retryDelay: @escaping (Int) -> Duration = { attempt in
      .seconds(min(1 << min(attempt, 4), 15))
    },
    save: @escaping (MockDraft) async -> Outcome
  ) {
    self.retryDelay = retryDelay
    self.save = save
  }

  var isBusy: Bool { sending || !waiting.isEmpty }

  func isWaiting(_ itemId: String) -> Bool {
    waiting.contains { $0.itemId == itemId }
  }

  func add(_ draft: MockDraft) {
    guard !isStopped else {
      return
    }

    if let index = waiting.firstIndex(where: { $0.itemId == draft.itemId }) {
      waiting[index] = draft
    } else {
      waiting.append(draft)
    }

    sendNext()
  }

  /// Returns once every answer so far is stored or refused, or the waiting task is cancelled.
  func idle() async {
    while isBusy, !Task.isCancelled {
      try? await Task.sleep(for: .milliseconds(50))
    }
  }

  /// For a section handed in, whose refused answers can't be sent again.
  func forgetRefusals() {
    refused.removeAll()
    settle()
  }

  func retryNow() {
    guard let retryTask else {
      return
    }

    retryTask.cancel()
    self.retryTask = nil
    sendNext()
  }

  /// For good: its screen is gone. What it hadn't sent stays on the device for the mock's next opening.
  func stop() {
    isStopped = true
    sendTask?.cancel()
    sendTask = nil
    retryTask?.cancel()
    retryTask = nil
    waiting.removeAll()
    sending = false
    settle()
  }

  private func sendNext() {
    guard !isStopped, !sending, retryTask == nil, !waiting.isEmpty else {
      settle()
      return
    }

    let draft = waiting.removeFirst()
    sending = true
    settle()

    sendTask = Task {
      let outcome = await save(draft)

      guard !isStopped else {
        return
      }

      sending = false
      if outcome == .stored {
        storedDrafts[draft.itemId] = draft
        failedDrafts[draft.itemId] = nil
        refused.remove(draft.itemId)
      } else {
        failedDrafts[draft.itemId] = draft
      }

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
        if outcome == .refused { refused.insert(draft.itemId) }
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
    } else if attempt > 0 && isBusy {
      status = .resending
    } else if !refused.isEmpty {
      // Another question's save doesn't hide that an answer still isn't saved.
      status = .refused
    } else {
      status = isBusy ? .saving : .saved
    }
  }
}
