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
  private static let pollInterval = Duration.seconds(4)

  /// Chapters whose map a tap is making right now.
  private(set) var requesting: Set<String> = []
  private(set) var failures: [String: MindMapRequestFailure] = [:]

  @ObservationIgnored private let api: MindMapsAPI
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var lists: [String: Resource<GoalMindMaps>] = [:]
  @ObservationIgnored private var maps: [String: Resource<ChapterMindMap>] = [:]

  init(api: MindMapsAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
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

  /// Makes the chapter's map from the learner's tap and follows it until it's drawn.
  func create(goalId: String, chapterId: String) async {
    guard let session = cache.session.authenticatedSession, !requesting.contains(chapterId) else {
      return
    }

    requesting.insert(chapterId)
    failures[chapterId] = nil
    defer { requesting.remove(chapterId) }

    do {
      try await api.create(token: session.bearerToken, goalId: goalId, chapterId: chapterId)
      await refresh(goalId: goalId, chapterId: chapterId)

      while try await api.status(token: session.bearerToken, goalId: goalId, chapterId: chapterId)
        == .generating
      {
        try await Task.sleep(for: Self.pollInterval)
      }
    } catch MindMapRequestFailure.limit {
      failures[chapterId] = .limit
    } catch APIError.unauthorized {
      await cache.session.expire(session)
      return
    } catch is CancellationError {
      return
    } catch {
      failures[chapterId] = .unreachable
    }

    await refresh(goalId: goalId, chapterId: chapterId)
  }

  private func refresh(goalId: String, chapterId: String) async {
    async let list: Void = list(goalId: goalId).refresh()
    async let map: Void = map(goalId: goalId, chapterId: chapterId).refresh()
    _ = await (list, map)
  }
}

struct MindMapsAPI: Sendable {
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
  func create(token: String, goalId: String, chapterId: String) async throws {
    let outcome: MindMapRequestFailure? = try await clients.perform(token: token) { client in
      switch try await client.createChapterMindMapGeneration(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok, .accepted: return nil
      case .code402, .forbidden, .tooManyRequests: return .limit
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }

    if let outcome {
      throw outcome
    }
  }
}

extension MindMapRequestFailure: Error {}
