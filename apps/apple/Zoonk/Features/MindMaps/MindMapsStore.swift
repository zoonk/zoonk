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

/// Main's `MindMapLimit`, and what ran out: the maps, the lessons a map writes first, or the day's
/// AI spend.
struct MindMapLimit: Equatable, Sendable {
  enum Resource: Hashable, Sendable {
    case aiSpend, lessons, mindMap
  }

  let limit: HelpLimit
  let resource: Resource
}

/// What a tap or following a run got that the map's own status doesn't say. It stands for the read
/// it appeared over: a newer read of the map that comes through clears it.
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
  private(set) var failures: [String: MindMapRequestFailure] = [:]
  /// The read count when each failure appeared; a read started after it clears it.
  @ObservationIgnored private var failedAt: [String: Int] = [:]
  @ObservationIgnored private var reads = 0

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
      audience: .signedIn, domains: [.goals, .userProgress, .userSubscription],
      isEmpty: \.chapters.isEmpty
    ) { [weak self] session in
      guard let session else {
        return nil
      }

      let started = await self?.readStarted()
      let read = try await api.list(token: session.bearerToken, goalId: goalId)
      await self?.readCameThrough(started, keys: read.chapters.map { "\(goalId):\($0.chapterId)" })
      return read
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
      audience: .signedIn, domains: [.goals, .userProgress, .userSubscription]
    ) { [weak self] session in
      guard let session else {
        return nil
      }

      let started = await self?.readStarted()
      let read = try await api.map(
        token: session.bearerToken, goalId: goalId, chapterId: chapterId)
      await self?.readCameThrough(started, keys: [key])
      return read
    }

    maps[key] = map
    return map
  }

  func failure(goalId: String, chapterId: String) -> MindMapRequestFailure? {
    failures["\(goalId):\(chapterId)"]
  }

  func create(goalId: String, chapterId: String) async {
    guard !requesting.contains(chapterId) else {
      return
    }

    requesting.insert(chapterId)
    defer { requesting.remove(chapterId) }
    fail(nil, goalId: goalId, chapterId: chapterId)

    let api = api
    let started = await cache.mutate { identity in
      try await api.create(token: identity.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    switch started {
    case .done(.read):
      if await !refresh(goalId: goalId, chapterId: chapterId) {
        fail(.unreachable, goalId: goalId, chapterId: chapterId)
      }
    case .done(.refused(let limit)):
      fail(.refused(limit), goalId: goalId, chapterId: chapterId)
    case .failed:
      fail(.unreachable, goalId: goalId, chapterId: chapterId)
    case .obsolete:
      break
    }
  }

  /// Only reads, never asks for the map again, and never gives up on a run on its own: writing the
  /// lessons can take minutes, and the server fails a run that stops reporting. It ends once what's
  /// shown of the map says where the run stands and the run is done. Leaving the screen or signing
  /// out ends it sooner, and three beats in a row whose reads don't come through end it as
  /// `unreachable`.
  func follow(goalId: String, chapterId: String) async {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    var missed = 0

    while cache.session.authenticatedSession == session {
      var beat = drawingPoll

      do {
        let read = try await api.status(
          token: session.bearerToken, goalId: goalId, chapterId: chapterId)
        var isRead = shows(read, goalId: goalId, chapterId: chapterId)

        if !isRead {
          isRead = await refresh(goalId: goalId, chapterId: chapterId)
        }

        if isRead {
          missed = 0

          if !read.isOnItsWay, shows(read, goalId: goalId, chapterId: chapterId) {
            return
          }

          beat = read == .writingLessons ? writingPoll : drawingPoll
        } else {
          missed += 1
        }
      } catch APIError.network, APIError.unavailable {
        missed += 1
      } catch {
        // Cancelled, or an answer reading again won't change.
        return
      }

      if missed == 3 {
        if !Task.isCancelled, cache.session.authenticatedSession == session {
          fail(.unreachable, goalId: goalId, chapterId: chapterId)
        }

        return
      }

      do {
        try await Task.sleep(for: beat)
      } catch {
        return
      }
    }
  }

  private func fail(_ failure: MindMapRequestFailure?, goalId: String, chapterId: String) {
    let key = "\(goalId):\(chapterId)"
    failures[key] = failure
    failedAt[key] = failure == nil ? nil : reads
  }

  private func readStarted() -> Int {
    reads += 1
    return reads
  }

  private func readCameThrough(_ started: Int?, keys: [String]) {
    guard let started else {
      return
    }

    for key in keys where (failedAt[key] ?? started) < started {
      failures[key] = nil
      failedAt[key] = nil
    }
  }

  /// Whether every copy of the map read so far, in the list and on its own, says `status`.
  private func shows(_ status: ChapterMindMap.Status, goalId: String, chapterId: String) -> Bool {
    let listed = lists[goalId]?.value?.chapters.first { $0.chapterId == chapterId }
    let map = maps["\(goalId):\(chapterId)"]?.value

    return [listed, map].allSatisfy { $0 == nil || $0?.status == status }
  }

  /// Reads again only the copies of the map already read; one not read yet loads fresh when shown.
  /// False when a read didn't come through.
  private func refresh(goalId: String, chapterId: String) async -> Bool {
    async let list = Self.reread(lists[goalId])
    async let map = Self.reread(maps["\(goalId):\(chapterId)"])
    let (listed, read) = await (list, map)
    return listed && read
  }

  private static func reread<Value>(_ resource: Resource<Value>?) async -> Bool {
    guard let resource, resource.value != nil else {
      return true
    }

    let revision = resource.revision
    await resource.refresh()
    return resource.revision != revision
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

    let ranOut: MindMapLimit.Resource =
      switch resource as? String {
      case "aiSpend": .aiSpend
      case "lessonStart", "generatedLessons": .lessons
      default: .mindMap
      }

    return .refused(MindMapLimit(limit: limit, resource: ranOut))
  }
}
