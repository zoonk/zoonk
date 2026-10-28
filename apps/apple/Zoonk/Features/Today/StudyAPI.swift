import Foundation

struct OpenedStudyDay: Decodable, Equatable, Sendable {
  let session: StudyDay
  let sessionId: String
  let target: StudyBlock?
}

enum BlockStart: Equatable, Sendable {
  case started
  /// Finished meanwhile on another device: read the day again.
  case finished
  case dailyLimitReached
  case earlierFirst
}

/// Every write here starts only from a tap.
protocol StudyAPIClient: Sendable {
  func getToday(token: String, timeZone: String) async throws -> TodayContent
  func openDay(
    token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
  ) async throws -> OpenedStudyDay
  func startBlock(token: String, sessionID: String, blockID: String, timeZone: String)
    async throws -> BlockStart
  func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock
  func catchUp(token: String, sessionID: String, timeZone: String) async throws
  func stop(token: String, sessionID: String, timeZone: String) async throws
  func getSession(token: String, sessionID: String) async throws -> StudyDay
  func getSummary(token: String, sessionID: String) async throws -> SessionSummary
  func lessonStatus(token: String, lessonID: String) async throws -> String
  /// Only on the learner's tap, since it runs AI.
  func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome
  func prepareSession(token: String, sessionID: String) async throws
  func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws
  func markMilestoneShown(token: String, milestoneID: String) async throws
  func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap
}

/// A tap that only opens the day (to add time or catch up) names none.
enum DayTarget: Encodable, Equatable, Sendable {
  case next(DayBlockRef)
  case ref(DayBlockRef)

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .next(let shown):
      try container.encode("next", forKey: .kind)
      try container.encode(shown, forKey: .shown)
    case .ref(let ref):
      try container.encode("ref", forKey: .kind)
      try container.encode(ref, forKey: .ref)
    }
  }

  private enum CodingKeys: String, CodingKey {
    case kind, ref, shown
  }
}

private struct OpenDayBody: Encodable {
  let keepEmpty: Bool
  let shownDate: String
  let target: DayTarget?
  let timeZone: String
}

private struct TimeZoneBody: Encodable {
  let timeZone: String
}

private struct BlockStartBody: Encodable {
  let afterWriting: Bool
  let timeZone: String
}

private struct StatusBody: Encodable {
  let status: String
}

private struct LessonReadiness: Decodable {
  let status: String
}

struct StudyAPI: StudyAPIClient {
  let clients: APIClientFactory

  func getToday(token: String, timeZone: String) async throws -> TodayContent {
    try await clients.perform(token: token) { client in
      switch try await client.getToday(query: .init(timeZone: timeZone)) {
      case .ok(let response):
        return .day(try StudyJSON.recode(try response.body.json))
      case .notFound(let response):
        let problem: TodayProblem = try StudyJSON.recode(try response.body.json)

        guard problem.error.code == "NO_ACTIVE_GOAL" else {
          throw APIError.notFound
        }

        return .noGoal(suggestedGoal: problem.error.details?.suggestedGoal)
      case .conflict(let response):
        let problem: TodayProblem = try StudyJSON.recode(try response.body.json)

        if problem.error.code == "PLAN_NOT_READY", let goal = problem.error.details?.goal {
          return .preparing(goalID: goal.id, title: goal.title)
        }

        return .goalNotActive
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func openDay(
    token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
  ) async throws -> OpenedStudyDay {
    let body = OpenDayBody(
      keepEmpty: target == nil, shownDate: shownDate, target: target, timeZone: timeZone)

    // Sent as its own JSON: the generated body drops the shown block's `null`s, which core needs.
    let json = try JSONEncoder().encode(body)

    return try await clients.perform(token: token, body: json) { client in
      switch try await client.openStudyDay(
        path: .init(goalId: goalID), body: .json(try StudyJSON.recode(body)))
      {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .created(let response):
        return try StudyJSON.recode(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func startBlock(token: String, sessionID: String, blockID: String, timeZone: String)
    async throws -> BlockStart
  {
    let body = BlockStartBody(afterWriting: false, timeZone: timeZone)

    return try await clients.perform(token: token) { client in
      switch try await client.createStudyBlockStart(
        path: .init(sessionId: sessionID, blockId: blockID), body: .json(try StudyJSON.recode(body))
      ) {
      case .ok:
        return .started
      case .forbidden:
        return .dailyLimitReached
      case .conflict(let response):
        let problem: APIProblem = try StudyJSON.recode(try response.body.json)
        return problem.error.code == "EARLIER_FIRST" ? .earlierFirst : .finished
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock {
    try await clients.perform(token: token) { client in
      switch try await client.createStudyExtraBlock(path: .init(sessionId: sessionID)) {
      case .created(let response):
        return try StudyJSON.recode(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func catchUp(token: String, sessionID: String, timeZone: String) async throws {
    let body = TimeZoneBody(timeZone: timeZone)

    try await clients.perform(token: token) { client in
      switch try await client.createStudyCatchUpBlocks(
        path: .init(sessionId: sessionID), body: .json(try StudyJSON.recode(body)))
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

  func stop(token: String, sessionID: String, timeZone: String) async throws {
    let body = TimeZoneBody(timeZone: timeZone)

    try await clients.perform(token: token) { client in
      switch try await client.createStudySessionStop(
        path: .init(sessionId: sessionID), body: .json(try StudyJSON.recode(body)))
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

  func getSession(token: String, sessionID: String) async throws -> StudyDay {
    try await clients.perform(token: token) { client in
      switch try await client.getStudySession(path: .init(sessionId: sessionID)) {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func getSummary(token: String, sessionID: String) async throws -> SessionSummary {
    try await clients.perform(token: token) { client in
      switch try await client.getStudySessionSummary(path: .init(sessionId: sessionID)) {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func lessonStatus(token: String, lessonID: String) async throws -> String {
    try await clients.perform(token: token) { client in
      switch try await client.getLibraryLessonReadiness(path: .init(lessonId: lessonID)) {
      case .ok(let response):
        let readiness: LessonReadiness = try StudyJSON.recode(try response.body.json)
        return readiness.status
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws {
    let body = StatusBody(status: accepted ? "accepted" : "dismissed")

    try await clients.perform(token: token) { client in
      switch try await client.answerSuggestedGoal(
        path: .init(suggestionId: suggestionID), body: .json(try StudyJSON.recode(body)))
      {
      case .ok, .conflict:
        // Already answered elsewhere: the suggestion is closed either way.
        return
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome {
    try await LessonPlayerAPI(clients: clients).writeLesson(id: lessonID, token: token)
  }

  func prepareSession(token: String, sessionID: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.createStudySessionPreparation(path: .init(sessionId: sessionID)) {
      case .accepted:
        return
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func markMilestoneShown(token: String, milestoneID: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.createMilestoneView(path: .init(milestoneId: milestoneID)) {
      case .ok:
        return
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserWeeklyRecap(query: .init(goalId: goalID)) {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }
}
