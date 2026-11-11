import Foundation
import OpenAPIRuntime

protocol MindMapsAPIClient: Sendable {
  func list(token: String, goalId: String) async throws -> GoalMindMaps
  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap
  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  func create(token: String, goalId: String, chapterId: String) async throws -> MindMapRequest
  func lessonMaps(token: String, goalId: String, chapterId: String) async throws
    -> ChapterLessonMaps
  /// Desired state: saving twice keeps one save. Answers whether it's saved now.
  func save(token: String, goalId: String, key: MindMapKey, saved: Bool) async throws -> Bool
  /// What started and what didn't shows in the list read again.
  func createAll(token: String, goalId: String) async throws
}

struct MindMapsAPI: MindMapsAPIClient {
  let clients: APIClientFactory

  func list(token: String, goalId: String) async throws -> GoalMindMaps {
    try await clients.perform(token: token) { client in
      switch try await client.listGoalMindMaps(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap {
    try await clients.perform(token: token) { client in
      switch try await client.getChapterMindMap(path: .init(goalId: goalId, chapterId: chapterId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  {
    try await clients.perform(token: token) { client in
      switch try await client.getChapterMindMapStatus(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok(let response):
        return ChapterMindMap.Status(rawValue: try response.body.json.status.rawValue) ?? .failed
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func create(token: String, goalId: String, chapterId: String) async throws -> MindMapRequest {
    try await clients.perform(token: token) { client in
      switch try await client.createChapterMindMapGeneration(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok, .accepted, .unprocessableContent: return .read
      case .code402(let response): return Self.refusal(try? response.body.json, status: 402)
      case .forbidden(let response): return Self.refusal(try? response.body.json, status: 403)
      case .tooManyRequests(let response): return Self.refusal(try? response.body.json, status: 429)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func lessonMaps(token: String, goalId: String, chapterId: String) async throws
    -> ChapterLessonMaps
  {
    try await clients.perform(token: token) { client in
      switch try await client.listChapterLessonMaps(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// A map that doesn't open anymore, or one locked for Plus, can't be saved: the screen says it
  /// couldn't.
  func save(token: String, goalId: String, key: MindMapKey, saved: Bool) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.saveMindMap(
        path: .init(goalId: goalId),
        body: .json(
          .init(
            kind: key.kind == .chapter ? .chapter : .lesson, saved: saved,
            targetId: key.targetId)))
      {
      case .ok(let response): return try response.body.json.saved
      case .unauthorized: throw APIError.unauthorized
      case .notFound, .code402: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func createAll(token: String, goalId: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.createGoalMindMapGenerations(path: .init(goalId: goalId)) {
      case .accepted: return
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// `PLUS_REQUIRED` is the map's own status, which the row reads; a limit names what ran out in
  /// `details.limit.resource`.
  private static func refusal(_ error: Components.Schemas._Error?, status: Int) -> MindMapRequest {
    let refusal = voiceRefusal(status: status, error: error)

    guard let limit = refusal.limit else {
      return .read
    }

    let details = refusal.details?.value as? [String: (any Sendable)?]
    let resource = ((details?["limit"] ?? nil) as? [String: (any Sendable)?])?["resource"] ?? nil

    let ranOut: MindMapLimit.Resource =
      switch resource as? String {
      case "aiSpend": .aiSpend
      case "lessonStart", "generatedLessons": .lessons
      default: .mindMap
      }

    return .refused(MindMapLimit(limit: limit, resource: ranOut))
  }
}
