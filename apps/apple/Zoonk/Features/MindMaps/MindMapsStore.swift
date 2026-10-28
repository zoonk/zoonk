import Foundation
import Observation

/// A chapter's mind map: its picture once drawn, and its outline (the map in words).
struct ChapterMindMap: Decodable, Equatable, Identifiable, Sendable {
  enum Status: String, Decodable, Sendable {
    /// The chapter can get a map: a tap makes it.
    case available
    case failed
    case generating
    case ready
    /// The chapter's lessons aren't written yet, or it gets no map.
    case unavailable
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
  let outline: Outline?
  let position: Int
  let status: Status
  let subject: Subject?
  let title: String

  var id: String { chapterId }
}

/// The goal's mind maps: the chapters the learner finished, each with its map or the tap that
/// makes it, and the chapter to finish next.
struct GoalMindMaps: Decodable, Equatable, Sendable {
  struct NextChapter: Decodable, Equatable, Sendable {
    let chapterId: String
    let lessonsLeft: Int
    let title: String
  }

  let chapters: [ChapterMindMap]
  let nextChapter: NextChapter?
}

/// Why a tap didn't start a map.
enum MindMapRequestFailure: Equatable, Sendable {
  /// The learner's plan reached its maps for now.
  case limit
  case unreachable
}

/// The goal's mind maps, and making one from a learner's tap: the tap asks for it, then its status
/// is read every few seconds while it's drawn (about half a minute), and the list and the chapter's
/// map are read again once it's ready or failed. Nothing is made on a screen's load.
@MainActor
@Observable
final class MindMapsStore {
  /// Chapters whose map a tap is making right now.
  private(set) var requesting: Set<String> = []
  private(set) var failures: [String: MindMapRequestFailure] = [:]
  @ObservationIgnored private var following: Set<String> = []

  @ObservationIgnored private let api: any MindMapsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let pollInterval: Duration
  @ObservationIgnored private var lists: [String: Resource<GoalMindMaps>] = [:]
  @ObservationIgnored private var maps: [String: Resource<ChapterMindMap>] = [:]

  init(api: any MindMapsAPIClient, cache: AppCache, pollInterval: Duration = .seconds(4)) {
    self.api = api
    self.cache = cache
    self.pollInterval = pollInterval
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

  /// Makes the chapter's map from the learner's tap. The list then says it's being drawn, and its
  /// tile follows it (`follow`).
  func create(goalId: String, chapterId: String) async {
    guard !requesting.contains(chapterId) else {
      return
    }

    requesting.insert(chapterId)
    failures[chapterId] = nil
    defer { requesting.remove(chapterId) }

    let api = api
    let started = await cache.mutate { identity in
      try await api.create(token: identity.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    switch started {
    case .done(true):
      await refresh(goalId: goalId, chapterId: chapterId)
    case .done(false):
      failures[chapterId] = .limit
    case .failed:
      failures[chapterId] = .unreachable
    case .obsolete:
      break
    }
  }

  /// Follows a map being drawn, whether a tap asked for it or it was already on its way: reads its
  /// status every few seconds (only reads, never asks for it again), through a dropped connection,
  /// and reads the list and the map again once it's drawn or failed. The server fails a drawing
  /// that stalls, so it ends; leaving the screen or signing out ends it sooner.
  func follow(goalId: String, chapterId: String) async {
    guard !following.contains(chapterId), let session = cache.session.authenticatedSession else {
      return
    }

    following.insert(chapterId)
    defer { following.remove(chapterId) }

    while cache.session.authenticatedSession == session {
      do {
        let status = try await api.status(
          token: session.bearerToken, goalId: goalId, chapterId: chapterId)

        guard status == .generating else {
          break
        }
      } catch APIError.network, APIError.unavailable {
        // Read again on the next beat.
      } catch {
        // Cancelled, or an answer reading again won't change: the list says where it stands.
        break
      }

      do {
        try await Task.sleep(for: pollInterval)
      } catch {
        return
      }
    }

    guard !Task.isCancelled, cache.session.authenticatedSession == session else {
      return
    }

    await refresh(goalId: goalId, chapterId: chapterId)
  }

  private func refresh(goalId: String, chapterId: String) async {
    async let list: Void = list(goalId: goalId).refresh()
    async let map: Void = map(goalId: goalId, chapterId: chapterId).refresh()
    _ = await (list, map)
  }
}

/// The mind maps' reads and the tap that makes one. `MindMapsAPI` calls the API; a Debug fixture
/// stands in for it (`Testing/`).
protocol MindMapsAPIClient: Sendable {
  func list(token: String, goalId: String) async throws -> GoalMindMaps
  func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap
  func status(token: String, goalId: String, chapterId: String) async throws
    -> ChapterMindMap.Status
  /// Asks for the chapter's map; false when the learner's plan reached its maps for now.
  func create(token: String, goalId: String, chapterId: String) async throws -> Bool
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

  /// Asks for the chapter's map. A cap of the learner's plan refuses it.
  func create(token: String, goalId: String, chapterId: String) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.createChapterMindMapGeneration(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok, .accepted: return true
      case .code402, .forbidden, .tooManyRequests: return false
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}
