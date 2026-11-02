import Foundation

typealias BuddyStatus = Components.Schemas.BuddyStatus
typealias MemoryInsight = Components.Schemas.MemoryInsight

struct BuddyChoice: Equatable, Sendable {
  var kind: BuddyKind
  var name: String?
  var glasses: BuddyGlasses
}

struct EarlierQuestionsPage: Equatable, Sendable {
  var questions: [Components.Schemas.EarlierQuestion]
  var nextCursor: String?
}

protocol BuddyAPIClient: Sendable {
  func status(timeZone: String, token: String) async throws -> BuddyStatus
  func save(_ buddy: BuddyChoice, token: String) async throws
  func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage
  func answer(insightId: String, accepted: Bool, token: String) async throws
}

struct BuddyAPI: BuddyAPIClient {
  let clients: APIClientFactory

  func status(timeZone: String, token: String) async throws -> BuddyStatus {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserBuddy(query: .init(timeZone: timeZone)) {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    try await clients.perform(token: token) { client in
      let input = Components.Schemas.BuddyInput(
        glasses: .init(rawValue: buddy.glasses.rawValue),
        kind: .init(rawValue: buddy.kind.rawValue) ?? .zu,
        name: buddy.name)
      let output = try await client.updateCurrentUserLearningProfile(
        body: .json(.init(buddy: .init(value1: input))))

      switch output {
      case .ok:
        return
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .unprocessableContent, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage {
    try await clients.perform(token: token) { client in
      switch try await client.listEarlierQuestions(query: .init(cursor: cursor)) {
      case .ok(let response):
        let page = try response.body.json
        return EarlierQuestionsPage(questions: page.questions, nextCursor: page.nextCursor)
      case .unauthorized:
        throw APIError.unauthorized
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func answer(insightId: String, accepted: Bool, token: String) async throws {
    try await clients.perform(token: token) { client in
      let output = try await client.answerMemoryInsight(
        path: .init(insightId: insightId),
        body: .json(.init(status: accepted ? .accepted : .dismissed)))

      switch output {
      case .ok, .conflict:
        // An insight answered elsewhere is answered: Today reads it again either way.
        return
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}
