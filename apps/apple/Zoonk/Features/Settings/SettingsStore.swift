import Foundation
import Observation

/// The settings pages' data for the signed-in learner: Preferences, Memory and the plan's
/// allowance, each a cached resource. Saves are optimistic: the control moves at once and goes
/// back, with "That didn't save", if the server refuses; a saved change invalidates what it touched
/// so the summary and other screens follow.
@MainActor
@Observable
final class SettingsStore {
  enum UndoStatus: Equatable {
    case failed
    case idle
    case undone
  }

  let preferences: Resource<LearningPreferences>
  let memory: Resource<LearnerMemory>
  let allowance: Resource<PlanAllowance>

  /// A save that didn't go through, said once under the controls until the next save.
  private(set) var saveFailed = false
  /// The fact the learner last deleted, for the "Memory updated" notice and its undo.
  private(set) var deletedFact: MemoryFact?
  private(set) var undoStatus = UndoStatus.idle

  private let api: any SettingsAPIClient
  private let cache: AppCache

  init(api: any SettingsAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache

    func signedIn<Value: Equatable & Sendable>(
      _ domains: Set<DataDomain>, _ load: @escaping (String) async throws -> Value
    ) -> Resource<Value> {
      cache.resource(audience: .signedIn, domains: domains) { session in
        guard let session else {
          return nil
        }

        return try await load(session.bearerToken)
      }
    }

    preferences = signedIn([.learningProfile]) { try await api.getPreferences(token: $0) }
    memory = signedIn([.memory]) { try await api.getMemory(token: $0) }
    allowance = signedIn([.allowance, .userSubscription]) { try await api.getAllowance(token: $0) }
  }

  func updatePreferences(_ update: PreferencesUpdate) async {
    guard let shown = preferences.value else {
      return
    }

    preferences.update(update.applied)

    let saved = await save([.learningProfile]) {
      try await $0.updatePreferences(token: $1, update)
    }

    preferences.update { _ in saved ?? shown }
  }

  func setMemoryEnabled(_ enabled: Bool) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { LearnerMemory(enabled: enabled, facts: $0.facts) }

    if await save([.memory], { try await $0.setMemoryEnabled(token: $1, enabled) }) == nil {
      memory.update { _ in shown }
    }
  }

  func updateMemoryFact(id: String, statement: String) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { $0.replacingFact(id: id) { $0.statement = statement } }

    let saved = await save([.memory]) {
      try await $0.updateMemoryFact(token: $1, factId: id, statement: statement)
    }

    if saved == nil {
      memory.update { _ in shown }
    }
  }

  func deleteMemoryFact(id: String) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { LearnerMemory(enabled: $0.enabled, facts: $0.facts.filter { $0.id != id }) }

    if let deleted = await save([.memory], { try await $0.deleteMemoryFact(token: $1, factId: id) })
    {
      deletedFact = deleted
      undoStatus = .idle
    } else {
      memory.update { _ in shown }
    }
  }

  /// Brings the last deleted fact back, with the facts it had replaced. Any failure means it
  /// changed since, as main says.
  func undoDeletion() async {
    guard let deleted = deletedFact else {
      return
    }

    let restored = await save([.memory]) {
      try await $0.restoreMemoryFact(token: $1, factId: deleted.id)
    }

    guard let restored else {
      saveFailed = false
      undoStatus = .failed
      return
    }

    let restoredIds = Set(restored.map(\.id))

    memory.update { memory in
      let facts = memory.facts.filter { !restoredIds.contains($0.id) } + restored
      return LearnerMemory(
        enabled: memory.enabled, facts: facts.sorted { $0.createdAt > $1.createdAt })
    }

    undoStatus = .undone
  }

  /// A purchase or restore changed the plan: the summary's tier and the allowance follow.
  func subscriptionChanged() {
    cache.invalidate([.allowance, .userSubscription])
  }

  /// Exports say their own failure beside their button, so they leave `saveFailed` alone.
  func exportMemory() async -> Data? {
    await save([], reportsFailure: false) { try await $0.exportMemory(token: $1) }
  }

  func exportAccountData() async -> Data? {
    await save([], reportsFailure: false) { try await $0.exportAccountData(token: $1) }
  }

  /// Runs a request for the current session and, once it succeeds, invalidates what it changed.
  /// Nil when it failed or the session changed meanwhile; an expired session signs out.
  private func save<Value: Sendable>(
    _ changed: Set<DataDomain>,
    reportsFailure: Bool = true,
    _ request: (any SettingsAPIClient, String) async throws -> Value
  ) async -> Value? {
    guard let session = cache.session.authenticatedSession else {
      return nil
    }

    if reportsFailure {
      saveFailed = false
    }

    do {
      let value = try await request(api, session.bearerToken)

      guard cache.session.authenticatedSession == session else {
        return nil
      }

      cache.invalidate(changed)
      return value
    } catch APIError.unauthorized {
      await cache.session.expire(session)
      return nil
    } catch {
      if reportsFailure {
        saveFailed = cache.session.authenticatedSession == session
      }

      return nil
    }
  }
}

extension LearnerMemory {
  fileprivate func replacingFact(id: String, _ change: (inout MemoryFact) -> Void) -> LearnerMemory
  {
    var memory = self

    if let index = memory.facts.firstIndex(where: { $0.id == id }) {
      change(&memory.facts[index])
    }

    return memory
  }
}
