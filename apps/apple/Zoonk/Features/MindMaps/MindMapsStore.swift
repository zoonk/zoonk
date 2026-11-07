import Foundation
import Observation
import OpenAPIRuntime

struct ChapterMindMap: Decodable, Equatable, Identifiable, Sendable {
  enum Status: String, Decodable, Sendable {
    case available
    case drawing
    case failed
    /// The chapter's lessons are Plus-only for this learner, so its map is too.
    case plusRequired
    case ready
    /// A language's unit, or nothing in its outline to draw from: no row at all.
    case unavailable
    case writingLessons

    var isOnItsWay: Bool {
      self == .writingLessons || self == .drawing
    }
  }

  struct Image: Decodable, Equatable, Sendable {
    let height: Int
    let thumbnailUrl: String?
    let url: String
    let width: Int
  }

  struct Outline: Decodable, Equatable, Sendable {
    struct Branch: Decodable, Equatable, Hashable, Sendable {
      let explanation: String
      let points: [String]
      let title: String
    }

    let branches: [Branch]
    let centralIdea: String
    let summary: String?
    let title: String
  }

  struct Subject: Decodable, Equatable, Sendable {
    let key: String
    let name: String
  }

  let chapterId: String
  let image: Image?
  /// The chapter's lessons not written yet, which making its map writes first.
  let lessonsToWrite: Int
  let outline: Outline?
  let position: Int
  let status: Status
  let subject: Subject?
  let title: String

  var id: String { chapterId }
}

struct GoalMindMaps: Decodable, Equatable, Sendable {
  /// Every chapter of the plan that can have a map, in plan order.
  let chapters: [ChapterMindMap]
}

/// Main's `MindMapLimit`, and whether what ran out was the lessons the map writes first.
struct MindMapLimit: Equatable, Sendable {
  let limit: HelpLimit
  let isLessons: Bool
}

/// What a tap on Create or Try again got that the map's own status doesn't say.
enum MindMapRequestFailure: Equatable, Sendable {
  case refused(MindMapLimit)
  case unreachable
}

enum MindMapRequest: Equatable, Sendable {
  /// Ready, on its way, Plus-only or a chapter without one: reading it again says which.
  case read
  case refused(MindMapLimit)
}

/// Nothing is made on a screen's load: only a learner's tap asks for a map.
@MainActor
@Observable
final class MindMapsStore {
  private(set) var requesting: Set<String> = []
  @ObservationIgnored private var following: Set<String> = []

  @ObservationIgnored private let api: any MindMapsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let drawingPoll: Duration
  @ObservationIgnored private let writingPoll: Duration
  @ObservationIgnored private var lists: [String: Resource<GoalMindMaps>] = [:]
  @ObservationIgnored private var maps: [String: Resource<ChapterMindMap>] = [:]

  init(
    api: any MindMapsAPIClient, cache: AppCache, drawingPoll: Duration = .seconds(4),
    writingPoll: Duration = .seconds(15)
  ) {
    self.api = api
    self.cache = cache
    self.drawingPoll = drawingPoll
    self.writingPoll = writingPoll
  }

  func list(goalId: String) -> Resource<GoalMindMaps> {
    if let list = lists[goalId] {
      return list
    }

    let api = api
    let list: Resource<GoalMindMaps> = cache.resource(
      audience: .signedIn, domains: [.goals, .userProgress],
      isEmpty: \.chapters.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken, goalId: goalId)
    }

    lists[goalId] = list
    return list
  }

  func map(goalId: String, chapterId: String) -> Resource<ChapterMindMap> {
    let key = "\(goalId):\(chapterId)"

    if let map = maps[key] {
      return map
    }

    let api = api
    let map: Resource<ChapterMindMap> = cache.resource(
      audience: .signedIn, domains: [.goals, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.map(token: session.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    maps[key] = map
    return map
  }

  /// What the tap got that the map's status won't say, for its row to show.
  func create(goalId: String, chapterId: String) async -> MindMapRequestFailure? {
    guard !requesting.contains(chapterId) else {
      return nil
    }

    requesting.insert(chapterId)
    defer { requesting.remove(chapterId) }

    let api = api
    let started = await cache.mutate { identity in
      try await api.create(token: identity.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    switch started {
    case .done(.read):
      await refresh(goalId: goalId, chapterId: chapterId)
      return nil
    case .done(.refused(let limit)):
      return .refused(limit)
    case .failed:
      return .unreachable
    case .obsolete:
      return nil
    }
  }

  /// Only reads, never asks for the map again, and never gives up on a run on its own: writing the
  /// lessons can take minutes, and the server fails a run that stops reporting. Leaving the screen
  /// or signing out ends it sooner, and three reads in a row that don't reach the server end it as
  /// `unreachable`. `status` is the one the row shows: once the lessons are written and the drawing
  /// starts, the row reads it again to say so.
  func follow(
    goalId: String, chapterId: String, from status: ChapterMindMap.Status
  ) async -> MindMapRequestFailure? {
    guard !following.contains(chapterId), let session = cache.session.authenticatedSession else {
      return nil
    }

    following.insert(chapterId)
    defer { following.remove(chapterId) }

    var shown = status
    var missed = 0

    while cache.session.authenticatedSession == session {
      do {
        let read = try await api.status(
          token: session.bearerToken, goalId: goalId, chapterId: chapterId)
        missed = 0

        guard read.isOnItsWay else {
          break
        }

        if read != shown {
          shown = read
          await refresh(goalId: goalId, chapterId: chapterId)
        }
      } catch APIError.network, APIError.unavailable {
        missed += 1

        if missed == 3 {
          return Task.isCancelled ? nil : .unreachable
        }
      } catch {
        // Cancelled, or an answer reading again won't change: the reads say where it stands.
        break
      }

      do {
        try await Task.sleep(for: shown == .writingLessons ? writingPoll : drawingPoll)
      } catch {
        return nil
      }
    }

    guard !Task.isCancelled, cache.session.authenticatedSession == session else {
      return nil
    }

    await refresh(goalId: goalId, chapterId: chapterId)
    return nil
  }

  private func refresh(goalId: String, chapterId: String) async {
    async let list: Void = list(goalId: goalId).refresh()
    async let map: Void = map(goalId: goalId, chapterId: chapterId).refresh()
    _ = await (list, map)
  }
}

protocol MindMapsAPIClient: Sendable {
  func list(token: String, goalId: String) async throws -> GoalMindMaps
  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap
  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  func create(token: String, goalId: String, chapterId: String) async throws -> MindMapRequest
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

  /// `PLUS_REQUIRED` is the map's own status, which the row reads; a limit names what ran out in
  /// `details.limit.resource`.
  private static func refusal(_ error: Components.Schemas._Error?, status: Int) -> MindMapRequest {
    let refusal = voiceRefusal(status: status, error: error)

    guard let limit = refusal.limit else {
      return .read
    }

    let details = refusal.details?.value as? [String: (any Sendable)?]
    let resource = ((details?["limit"] ?? nil) as? [String: (any Sendable)?])?["resource"] ?? nil

    return .refused(
      MindMapLimit(
        limit: limit,
        isLessons: ["lessonStart", "generatedLessons"].contains(resource as? String)))
  }
}
