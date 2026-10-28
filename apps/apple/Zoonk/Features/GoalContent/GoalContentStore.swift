import Foundation
import Observation

struct GoalChapter: Decodable, Equatable, Sendable {
  struct Chapter: Decodable, Equatable, Sendable {
    struct Subject: Decodable, Equatable, Sendable {
      let key: String
      let name: String
    }

    let chapterId: String
    let position: Int
    let state: String
    let subject: Subject?
    let title: String
  }

  struct Lesson: Decodable, Equatable, Identifiable, Sendable {
    enum State: String, Decodable, Sendable {
      case done
      case next
      case upcoming
    }

    let lessonId: String
    let minutes: Int
    let plusRequired: Bool
    let state: State
    let title: String

    var id: String { lessonId }
  }

  struct Mistakes: Decodable, Equatable, Sendable {
    let open: Int
  }

  struct Skill: Decodable, Equatable, Identifiable, Sendable {
    enum State: String, Decodable, Sendable {
      case learning
      case mastered
      case new
      case solid
    }

    let fading: Bool
    let name: String
    let skillId: String
    let state: State

    var id: String { skillId }
  }

  struct Summary: Decodable, Equatable, Identifiable, Sendable {
    let ideas: [String]
    let lessonId: String
    let title: String

    var id: String { lessonId }
  }

  struct TestOut: Decodable, Equatable, Sendable {
    let available: Bool
    let plusRequired: Bool
  }

  let chapter: Chapter
  let lessons: [Lesson]
  let mistakes: Mistakes
  let skills: [Skill]
  let summaries: [Summary]
  let testOut: TestOut
}

enum AreaPracticeOutcome: Equatable, Sendable {
  case dailyCap
  case nothingToPractice
  case opened(AppRoute)
}

private struct AreaPracticeBlock: Decodable {
  struct Block: Decodable {
    let id: String
    let kind: String
    let lessonId: String?
  }

  let block: Block
  let sessionId: String
}

@MainActor
@Observable
final class GoalContentStore {
  @ObservationIgnored private let api: GoalContentAPI
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var chapters: [String: Resource<GoalChapter>] = [:]
  @ObservationIgnored private var units: [String: Resource<LanguageUnit>] = [:]

  init(api: GoalContentAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func chapter(goalId: String, chapterId: String) -> Resource<GoalChapter> {
    let key = "\(goalId):\(chapterId)"

    if let chapter = chapters[key] {
      return chapter
    }

    let api = api
    let chapter: Resource<GoalChapter> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.chapter(
        token: session.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    chapters[key] = chapter
    return chapter
  }

  func unit(goalId: String, chapterId: String) -> Resource<LanguageUnit> {
    let key = "\(goalId):\(chapterId)"

    if let unit = units[key] {
      return unit
    }

    let api = api
    let unit: Resource<LanguageUnit> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.unit(token: session.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    units[key] = unit
    return unit
  }

  func practice(goalId: String, areaId: String) async -> AreaPracticeOutcome? {
    guard let session = cache.session.authenticatedSession else {
      return nil
    }

    do {
      let outcome = try await api.practice(
        token: session.bearerToken, goalId: goalId, areaId: areaId)

      if case .opened = outcome {
        cache.invalidate([.userProgress])
      }

      return outcome
    } catch APIError.unauthorized {
      await cache.session.expire(session)
      return nil
    } catch {
      return nil
    }
  }
}

struct GoalContentAPI: Sendable {
  let clients: APIClientFactory

  func chapter(token: String, goalId: String, chapterId: String) async throws -> GoalChapter {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalChapter(path: .init(goalId: goalId, chapterId: chapterId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func practice(token: String, goalId: String, areaId: String) async throws -> AreaPracticeOutcome {
    try await clients.perform(token: token) { client in
      switch try await client.createAreaPractice(
        path: .init(goalId: goalId),
        body: .json(.init(areaId: areaId, timeZone: TimeZone.current.identifier)))
      {
      case .created(let response):
        let added: AreaPracticeBlock = try PracticeJSON.recode(try response.body.json)

        if added.block.kind == "learn", let lessonId = added.block.lessonId {
          return .opened(.lesson(lessonId: lessonId, sessionId: added.sessionId))
        }

        return .opened(.questionBlock(sessionId: added.sessionId, blockId: added.block.id))
      case .conflict: return .dailyCap
      case .unprocessableContent: return .nothingToPractice
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}
