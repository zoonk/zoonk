import Foundation

typealias BuddyStatus = Components.Schemas.BuddyStatus
typealias MemoryInsight = Components.Schemas.MemoryInsight
/// A page of a goal's Buddy conversations, the latest asked in first.
typealias BuddyConversations = Components.Schemas.BuddyConversations
typealias BuddyConversation = Components.Schemas.BuddyConversations.ConversationsPayloadPayload

struct BuddyChoice: Equatable, Sendable {
  var kind: BuddyKind
  var name: String?
  var glasses: BuddyGlasses

  var input: Components.Schemas.BuddyInput? {
    guard let kind = Components.Schemas.BuddyInput.KindPayload(rawValue: kind.rawValue),
      let glasses = Components.Schemas.BuddyInput.GlassesPayload(rawValue: glasses.rawValue)
    else { return nil }
    return .init(glasses: glasses, kind: kind, name: name)
  }
}

protocol BuddyAPIClient: Sendable {
  func status(timeZone: String, token: String) async throws -> BuddyStatus
  func conversations(goalId: String, cursor: String?, token: String) async throws
    -> BuddyConversations
  func save(_ buddy: BuddyChoice, token: String) async throws
  /// The insight as the answer left it; nil when it was answered elsewhere.
  func answer(insightId: String, accepted: Bool, quote: PlanChangeQuote?, token: String)
    async throws -> MemoryInsight?
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

  func conversations(goalId: String, cursor: String?, token: String) async throws
    -> BuddyConversations
  {
    try await clients.perform(token: token) { client in
      switch try await client.listBuddyConversations(
        path: .init(goalId: goalId), query: .init(cursor: cursor))
      {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    try await clients.perform(token: token) { client in
      guard let input = buddy.input else { throw APIError.unavailable }
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

  func answer(insightId: String, accepted: Bool, quote: PlanChangeQuote?, token: String)
    async throws -> MemoryInsight?
  {
    let body: Components.Schemas.MemoryInsightAnswer = try StudyJSON.recode(
      InsightAnswerBody(status: accepted ? "accepted" : "dismissed", quote: quote))

    return try await clients.perform(token: token) { client in
      let output = try await client.answerMemoryInsight(
        path: .init(insightId: insightId), body: .json(body))

      switch output {
      case .ok(let response):
        return try response.body.json.insight
      case .conflict:
        // An insight answered elsewhere is answered: Today reads it again either way.
        return nil
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

/// `MemoryInsightAnswer`: accepting a plan change insight sends back the quote the learner saw.
private struct InsightAnswerBody: Encodable {
  let status: String
  let quote: PlanChangeQuote?
}
