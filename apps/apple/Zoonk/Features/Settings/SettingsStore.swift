import Foundation
import Observation

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

  /// Kept with the learner it's about, so the next learner never sees it.
  private struct Notice {
    var owner: AuthenticatedSession
    var saveFailed = false
    var deletedFact: MemoryFact?
    var undoStatus = UndoStatus.idle
  }

  private var notice: Notice?

  var saveFailed: Bool {
    currentNotice?.saveFailed ?? false
  }

  var deletedFact: MemoryFact? {
    currentNotice?.deletedFact
  }

  var undoStatus: UndoStatus {
    currentNotice?.undoStatus ?? .idle
  }

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

    let result = await save([.learningProfile]) {
      try await api.updatePreferences(token: $0.bearerToken, update)
    }

    switch result {
    case .done(let saved):
      preferences.update { _ in saved }
    case .failed:
      preferences.update { _ in shown }
    case .obsolete:
      break
    }
  }

  func setMemoryEnabled(_ enabled: Bool) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { LearnerMemory(enabled: enabled, facts: $0.facts) }

    if case .failed = await save(
      [.memory], { try await api.setMemoryEnabled(token: $0.bearerToken, enabled) })
    {
      memory.update { _ in shown }
    }
  }

  func updateMemoryFact(id: String, statement: String) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { $0.replacingFact(id: id) { $0.statement = statement } }

    let result = await save([.memory]) {
      try await api.updateMemoryFact(token: $0.bearerToken, factId: id, statement: statement)
    }

    if case .failed = result {
      memory.update { _ in shown }
    }
  }

  func deleteMemoryFact(id: String) async {
    guard let shown = memory.value else {
      return
    }

    memory.update { LearnerMemory(enabled: $0.enabled, facts: $0.facts.filter { $0.id != id }) }

    let result = await save([.memory]) {
      try await api.deleteMemoryFact(token: $0.bearerToken, factId: id)
    }

    switch result {
    case .done(let deleted):
      setNotice {
        $0.deletedFact = deleted
        $0.undoStatus = .idle
      }
    case .failed:
      memory.update { _ in shown }
    case .obsolete:
      break
    }
  }

  func undoDeletion() async {
    guard let deleted = deletedFact else {
      return
    }

    let result = await cache.mutate(invalidating: [.memory]) {
      try await api.restoreMemoryFact(token: $0.bearerToken, factId: deleted.id)
    }

    switch result {
    case .done(let restored):
      let restoredIds = Set(restored.map(\.id))

      memory.update { memory in
        let facts = memory.facts.filter { !restoredIds.contains($0.id) } + restored
        return LearnerMemory(
          enabled: memory.enabled, facts: facts.sorted { $0.createdAt > $1.createdAt })
      }

      setNotice { $0.undoStatus = .undone }
    case .failed:
      setNotice { $0.undoStatus = .failed }
    case .obsolete:
      break
    }
  }

  func subscriptionChanged() {
    cache.invalidate([.allowance, .userSubscription])
  }

  /// Exports say their own failure beside their button, so they leave `saveFailed` alone.
  func exportMemory() async -> Data? {
    await cache.mutate { try await api.exportMemory(token: $0.bearerToken) }.value
  }

  func exportAccountData() async -> Data? {
    await cache.mutate { try await api.exportAccountData(token: $0.bearerToken) }.value
  }

  private var currentNotice: Notice? {
    notice?.owner == cache.session.authenticatedSession ? notice : nil
  }

  private func setNotice(_ change: (inout Notice) -> Void) {
    guard let owner = cache.session.authenticatedSession else {
      return
    }

    var next = currentNotice ?? Notice(owner: owner)
    change(&next)
    notice = next
  }

  private func save<Value: Sendable>(
    _ changed: Set<DataDomain>,
    _ write: (AuthenticatedSession) async throws -> Value
  ) async -> MutationResult<Value> {
    setNotice { $0.saveFailed = false }
    let result = await cache.mutate(invalidating: changed, write)

    if case .failed = result {
      setNotice { $0.saveFailed = true }
    }

    return result
  }
}

extension MutationResult {
  fileprivate var value: Value? {
    if case .done(let value) = self { value } else { nil }
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
