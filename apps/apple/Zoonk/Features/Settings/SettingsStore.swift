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
  private let preferenceSaves: QueuedSaves<LearningPreferences>
  private let memorySaves: QueuedSaves<LearnerMemory>

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

    let preferences: Resource<LearningPreferences> = signedIn([.learningProfile]) {
      try await api.getPreferences(token: $0)
    }
    let memory: Resource<LearnerMemory> = signedIn([.memory]) {
      try await api.getMemory(token: $0)
    }
    self.preferences = preferences
    self.memory = memory
    allowance = signedIn([.allowance, .userSubscription]) { try await api.getAllowance(token: $0) }
    preferenceSaves = QueuedSaves(preferences, cache: cache)
    memorySaves = QueuedSaves(memory, cache: cache)
  }

  func updatePreferences(_ update: PreferencesUpdate) async {
    _ = await save(update.applied, in: preferenceSaves, changing: [.learningProfile]) { [api] in
      try await api.updatePreferences(token: $0.bearerToken, update)
    } confirm: {
      update.copied(from: $1, to: $0)
    }
  }

  func setMemoryEnabled(_ enabled: Bool) async {
    let change = { (memory: LearnerMemory) in LearnerMemory(enabled: enabled, facts: memory.facts) }

    _ = await save(change, in: memorySaves, changing: [.memory]) { [api] in
      try await api.setMemoryEnabled(token: $0.bearerToken, enabled)
    } confirm: { memory, _ in
      change(memory)
    }
  }

  func updateMemoryFact(id: String, statement: String) async {
    let change = { (memory: LearnerMemory) in
      memory.replacingFact(id: id) { $0.statement = statement }
    }

    _ = await save(change, in: memorySaves, changing: [.memory]) { [api] in
      try await api.updateMemoryFact(token: $0.bearerToken, factId: id, statement: statement)
    } confirm: { memory, _ in
      change(memory)
    }
  }

  func deleteMemoryFact(id: String) async {
    let change = { (memory: LearnerMemory) in
      LearnerMemory(enabled: memory.enabled, facts: memory.facts.filter { $0.id != id })
    }

    let result = await save(change, in: memorySaves, changing: [.memory]) { [api] in
      try await api.deleteMemoryFact(token: $0.bearerToken, factId: id)
    } confirm: { memory, _ in
      change(memory)
    }

    if case .done(let deleted) = result {
      setNotice {
        $0.deletedFact = deleted
        $0.undoStatus = .idle
      }
    }
  }

  /// Waits its turn behind the memory's other changes, so the restored fact stays once they settle.
  func undoDeletion() async {
    guard let deleted = deletedFact else {
      return
    }

    let unchanged = { (memory: LearnerMemory) in memory }

    let result = await memorySaves.save(unchanged, invalidating: [.memory]) { [api] in
      try await api.restoreMemoryFact(token: $0.bearerToken, factId: deleted.id)
    } confirm: {
      $0.restoring($1)
    }

    // A deletion made meanwhile has its own notice and its own undo.
    guard deletedFact?.id == deleted.id else {
      return
    }

    switch result {
    case .done:
      setNotice { $0.undoStatus = .undone }
    case .failed:
      setNotice { $0.undoStatus = .failed }
    case .obsolete, nil:
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

  private func save<Value: Equatable & Sendable, Reply: Sendable>(
    _ change: @escaping (Value) -> Value,
    in saves: QueuedSaves<Value>,
    changing domains: Set<DataDomain>,
    _ write: @escaping (AuthenticatedSession) async throws -> Reply,
    confirm: @escaping (Value, Reply) -> Value
  ) async -> MutationResult<Reply>? {
    setNotice { $0.saveFailed = false }
    let result = await saves.save(change, invalidating: domains, write, confirm: confirm)

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

  /// Newest first, as the server lists them.
  fileprivate func restoring(_ restored: [MemoryFact]) -> LearnerMemory {
    let restoredIds = Set(restored.map(\.id))
    let facts = facts.filter { !restoredIds.contains($0.id) } + restored
    return LearnerMemory(enabled: enabled, facts: facts.sorted { $0.createdAt > $1.createdAt })
  }
}
