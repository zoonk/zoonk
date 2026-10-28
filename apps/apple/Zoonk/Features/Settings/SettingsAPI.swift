import Foundation
import OpenAPIRuntime

protocol SettingsAPIClient: Sendable {
  func getPreferences(token: String) async throws -> LearningPreferences
  func updatePreferences(token: String, _ update: PreferencesUpdate) async throws
    -> LearningPreferences
  func getMemory(token: String) async throws -> LearnerMemory
  func setMemoryEnabled(token: String, _ enabled: Bool) async throws
  func updateMemoryFact(token: String, factId: String, statement: String) async throws
    -> MemoryFact
  func deleteMemoryFact(token: String, factId: String) async throws -> MemoryFact
  func restoreMemoryFact(token: String, factId: String) async throws -> [MemoryFact]
  func getAllowance(token: String) async throws -> PlanAllowance
  func exportMemory(token: String) async throws -> Data
  func exportAccountData(token: String) async throws -> Data
}

struct SettingsAPI: SettingsAPIClient {
  let clients: APIClientFactory

  func getPreferences(token: String) async throws -> LearningPreferences {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserLearningProfile(.init()) {
      case .ok(let response):
        return LearningPreferences(try response.body.json.profile)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func updatePreferences(token: String, _ update: PreferencesUpdate) async throws
    -> LearningPreferences
  {
    try await clients.perform(token: token, sendingNull: update.nullKeys) { client in
      switch try await client.updateCurrentUserLearningProfile(body: .json(update.body)) {
      case .ok(let response):
        return LearningPreferences(try response.body.json.profile)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func getMemory(token: String) async throws -> LearnerMemory {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserMemory(.init()) {
      case .ok(let response):
        let memory = try response.body.json
        return LearnerMemory(enabled: memory.enabled, facts: memory.facts.map(MemoryFact.init))
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func setMemoryEnabled(token: String, _ enabled: Bool) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.updateCurrentUserMemorySettings(body: .json(.init(enabled: enabled)))
      {
      case .ok:
        return
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func updateMemoryFact(token: String, factId: String, statement: String) async throws
    -> MemoryFact
  {
    try await clients.perform(token: token) { client in
      let output = try await client.updateMemoryFact(
        path: .init(factId: factId), body: .json(.init(statement: statement)))

      switch output {
      case .ok(let response):
        return MemoryFact(try response.body.json.fact)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  /// Returns the fact an undo sends back.
  func deleteMemoryFact(token: String, factId: String) async throws -> MemoryFact {
    try await clients.perform(token: token) { client in
      switch try await client.deleteMemoryFact(path: .init(factId: factId)) {
      case .ok(let response):
        return MemoryFact(try response.body.json.change.previous)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  /// Returns the fact with the facts it had replaced.
  func restoreMemoryFact(token: String, factId: String) async throws -> [MemoryFact] {
    try await clients.perform(token: token) { client in
      let output = try await client.createMemoryChangeReversal(
        body: .json(.init(changes: [.init(factId: nil, previousFactId: factId)])))

      switch output {
      case .ok(let response):
        return try response.body.json.restored.map(MemoryFact.init)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func getAllowance(token: String) async throws -> PlanAllowance {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserAllowance(.init()) {
      case .ok(let response):
        return PlanAllowance(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func exportMemory(token: String) async throws -> Data {
    try await clients.perform(token: token) { client in
      switch try await client.exportCurrentUserMemory(.init()) {
      case .ok(let response):
        return try exportFile(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func exportAccountData(token: String) async throws -> Data {
    try await clients.perform(token: token) { client in
      switch try await client.exportCurrentUserData(.init()) {
      case .ok(let response):
        return try exportFile(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }
}

private func exportFile(_ value: some Encodable) throws -> Data {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  encoder.dateEncodingStrategy = .iso8601
  return try encoder.encode(value)
}
