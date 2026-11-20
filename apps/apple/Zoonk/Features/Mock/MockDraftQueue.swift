import Foundation
import Observation

/// One learner's mock answers not yet stored on the server, kept on the device so closing the mock
/// or losing the app offline never loses them. Each write reads storage again so two open windows
/// for the same mock never overwrite each other's unsent answers.
struct UnsentMockDrafts {
  private let key: String
  private let defaults: UserDefaults

  init(learnerId: String, blockId: String, defaults: UserDefaults = .standard) {
    key = "mock.unsent.\(learnerId).\(blockId)"
    self.defaults = defaults
  }

  func read() -> [MockDraft] {
    defaults.data(forKey: key).flatMap { try? JSONDecoder().decode([MockDraft].self, from: $0) }
      ?? []
  }

  func keep(_ draft: MockDraft) {
    var current = read()

    if let index = current.firstIndex(where: { $0.itemId == draft.itemId }) {
      current[index] = draft
    } else {
      current.append(draft)
    }

    write(current)
  }

  /// Removes an entry only when storage still holds this exact version, keeping any newer edit.
  func drop(_ draft: MockDraft) {
    let current = read()
    let next = current.filter { $0 != draft }

    if next.count != current.count {
      write(next)
    }
  }

  /// Returns unsent drafts for the current section that differ from what the server already stored,
  /// dropping only already-stored copies for this section so another window's newer section stays intact.
  func restore(for itemIds: Set<String>, matching stored: [String: MockDraft]) -> [MockDraft] {
    let current = read()
    let remaining = current.filter { !itemIds.contains($0.itemId) || stored[$0.itemId] != $0 }

    if remaining.count != current.count {
      write(remaining)
    }

    return remaining.filter { itemIds.contains($0.itemId) }
  }

  func clear() {
    defaults.removeObject(forKey: key)
  }

  private func write(_ drafts: [MockDraft]) {
    if drafts.isEmpty {
      defaults.removeObject(forKey: key)
    } else if let data = try? JSONEncoder().encode(drafts) {
      defaults.set(data, forKey: key)
    }
  }
}

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
    case stop
  }

  private(set) var status: Status = .saved
  private var failedDrafts: [String: MockDraft] = [:]
  private var storedDrafts: [String: MockDraft] = [:]

  func countsTowardsProgress(_ draft: MockDraft?, initiallyStored: MockDraft?) -> Bool {
    guard let draft, draft.isAnswered else { return false }
    let stored = storedDrafts[draft.itemId] ?? initiallyStored
    return draft.answer != failedDrafts[draft.itemId]?.answer || draft.answer == stored?.answer
  }

  /// Runs once a draft is stored or permanently refused, never on unreachable or stop.
  @ObservationIgnored var onSettled: (MockDraft) -> Void
  @ObservationIgnored private let save: (MockDraft) async -> Outcome
  @ObservationIgnored private let retryDelay: (Int) -> Duration
  @ObservationIgnored private var waiting: [MockDraft] = []
  @ObservationIgnored private var sending: MockDraft?
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var refused: Set<String> = []
  @ObservationIgnored private var retryTask: Task<Void, Never>?
  @ObservationIgnored private var sendTask: Task<Void, Never>?
  @ObservationIgnored private var isStopped = false

  init(
    retryDelay: @escaping (Int) -> Duration = { attempt in
      .seconds(min(1 << min(attempt, 4), 15))
    },
    onSettled: @escaping (MockDraft) -> Void = { _ in },
    save: @escaping (MockDraft) async -> Outcome
  ) {
    self.retryDelay = retryDelay
    self.onSettled = onSettled
    self.save = save
  }

  var isBusy: Bool { sending != nil || !waiting.isEmpty }

  /// The newest answer to each question not stored yet, the one going out included, in order.
  var pending: [MockDraft] {
    var result: [MockDraft] = []
    var indexes: [String: Int] = [:]

    for draft in (sending.map { [$0] } ?? []) + waiting {
      if let index = indexes[draft.itemId] {
        result[index] = draft
      } else {
        indexes[draft.itemId] = result.count
        result.append(draft)
      }
    }

    return result
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

  /// Returns true once every answer so far is stored or refused, or false if stopped or cancelled.
  @discardableResult
  func idle() async -> Bool {
    while isBusy, !isStopped, !Task.isCancelled {
      try? await Task.sleep(for: .milliseconds(50))
    }

    return !isStopped && !Task.isCancelled
  }

  /// For a section handed in, whose refused answers can't be sent again.
  func forgetRefusals() {
    refused.removeAll()
    settle()
  }

  func retryNow() {
    guard !isStopped, let retryTask else {
      return
    }

    retryTask.cancel()
    self.retryTask = nil
    sendNext()
  }

  /// Ends this screen's retry loop without clearing what the device already kept.
  func stop() {
    isStopped = true
    sendTask?.cancel()
    sendTask = nil
    retryTask?.cancel()
    retryTask = nil
    waiting.removeAll()
    sending = nil
    settle()
  }

  private func sendNext() {
    guard !isStopped, sending == nil, retryTask == nil, !waiting.isEmpty else {
      settle()
      return
    }

    let draft = waiting.removeFirst()
    sending = draft
    settle()

    sendTask = Task {
      let outcome = await save(draft)

      guard !isStopped else {
        return
      }

      sending = nil

      switch outcome {
      case .stop:
        isStopped = true
        retryTask?.cancel()
        retryTask = nil
        waiting.removeAll()
        settle()
      case .unreachable:
        failedDrafts[draft.itemId] = draft
        // Keep it first in line, unless a newer answer to its question replaced it meanwhile.
        if !waiting.contains(where: { $0.itemId == draft.itemId }) {
          waiting.insert(draft, at: 0)
        }

        scheduleRetry()
        settle()
      case .stored:
        storedDrafts[draft.itemId] = draft
        failedDrafts[draft.itemId] = nil
        refused.remove(draft.itemId)
        attempt = 0
        onSettled(draft)
        sendNext()
      case .refused:
        failedDrafts[draft.itemId] = draft
        refused.insert(draft.itemId)
        attempt = 0
        onSettled(draft)
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
