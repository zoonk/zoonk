import Foundation
import Observation

/// Sends answers one after another, so an older answer to a question never lands after a newer one.
/// A newer answer to a question still waiting replaces the older one, since each holds everything
/// about its question. A refused save isn't tried again: nothing would change.
@MainActor
@Observable
final class MockDraftQueue {
  enum Status: Equatable {
    case saved
    case saving
    case retrying
    case refused
  }

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

  func add(_ draft: MockDraft) {
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

  func retryNow() {
    guard let retryTask else {
      return
    }

    retryTask.cancel()
    self.retryTask = nil
    sendNext()
  }

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
