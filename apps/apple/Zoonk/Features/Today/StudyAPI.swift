import Foundation

typealias StudyBlockOpening = Components.Schemas.StudyBlockOpening
typealias StudyBlockOpeningTarget = Components.Schemas.StudyBlockOpeningTarget

struct OpenedStudyDay: Decodable, Equatable, Sendable {
  /// Nil when the day opened without a target, or its target can't start.
  let opening: StudyBlockOpening?
  let sessionId: String
}

/// Every write here starts only from a tap.
protocol StudyAPIClient: Sendable {
  func getToday(token: String, timeZone: String) async throws -> TodayContent
  func openDay(
    token: String, goalID: String, shownDate: String, timeZone: String, target: DayTarget?
  ) async throws -> OpenedStudyDay
  /// The server decides where the block opens, and starts it when its screen doesn't.
  func openBlock(token: String, target: StudyBlockOpeningTarget, timeZone: String) async throws
    -> StudyBlockOpening
  func addExtraBlock(token: String, sessionID: String) async throws -> StudyBlock
  func catchUp(token: String, sessionID: String, timeZone: String) async throws
  func stop(token: String, sessionID: String, timeZone: String) async throws
  func getSession(token: String, sessionID: String) async throws -> StudyDay
  func getSummary(token: String, sessionID: String) async throws -> SessionSummary
  func lessonReadiness(token: String, lessonID: String) async throws
    -> Components.Schemas.LessonReadiness
  /// Only on the learner's tap, since it runs AI.
  func writeLesson(token: String, lessonID: String) async throws -> LessonWritingOutcome
  /// How the lesson stands once no run writes it; `run` is the one the learner's tap started.
  func followWriting(token: String, lessonID: String, run: String?) async throws
    -> Components.Schemas.LessonReadiness
  /// Only on the learner's tap, since it outlines the day's lessons with AI.
  func prepareLessons(token: String, goalID: String) async throws
  /// Only on the learner's tap: research reads their uploads instead of searching again.
  func answerUploadRequest(token: String, goalID: String, sourceIDs: [String]) async throws
  func dismissUploadRequest(token: String, goalID: String) async throws
  func answerSuggestedGoal(token: String, suggestionID: String, accepted: Bool) async throws
  func markMilestoneShown(token: String, milestoneID: String) async throws
  func getWeeklyRecap(token: String, goalID: String?) async throws -> WeeklyRecap
  func getLanguageToday(token: String, goalID: String) async throws -> LanguageTodayView
  func decidePlanChange(
    token: String, goalID: String, changeID: String, decision: PlanChangeDecision
  ) async throws -> TodayView.PlanChange?
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

private struct StatusBody: Encodable {
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

    return try await sendingAgainIfRetryable {
      try await clients.perform(token: token, body: json) { client -> OpenedStudyDay? in
        switch try await client.openStudyDay(
          path: .init(goalId: goalID), body: .json(try StudyJSON.recode(body)))
        {
        case .ok(let response):
          return try StudyJSON.recode(try response.body.json, as: OpenedStudyDay.self)
        case .created(let response):
          return try StudyJSON.recode(try response.body.json, as: OpenedStudyDay.self)
        case .conflict(let response):
          return try retryable(StudyJSON.recode(try response.body.json))
        case .unauthorized:
          throw APIError.unauthorized
        case .notFound:
          throw APIError.notFound
        default:
          throw APIError.unavailable
        }
      }
    }
  }

  func openBlock(token: String, target: StudyBlockOpeningTarget, timeZone: String) async throws
    -> StudyBlockOpening
  {
    try await sendingAgainIfRetryable {
      try await clients.perform(token: token) { client -> StudyBlockOpening? in
        switch try await client.openStudyBlock(
          body: .json(.init(target: target, timeZone: timeZone)))
        {
        case .ok(let response):
          return try response.body.json
        case .conflict(let response):
          return try retryable(StudyJSON.recode(try response.body.json))
        case .unauthorized:
          throw APIError.unauthorized
        case .notFound:
          throw APIError.notFound
        default:
          throw APIError.unavailable
        }
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

  func lessonReadiness(token: String, lessonID: String) async throws
    -> Components.Schemas.LessonReadiness
  {
    try await LessonPlayerAPI(clients: clients).getReadiness(id: lessonID, token: token)
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

  func followWriting(token: String, lessonID: String, run: String?) async throws
    -> Components.Schemas.LessonReadiness
  {
    try await LessonPlayerAPI(clients: clients).followWriting(id: lessonID, run: run, token: token)
  }

  func getLanguageToday(token: String, goalID: String) async throws -> LanguageTodayView {
    try await clients.perform(token: token) { client in
      switch try await client.getLanguageToday(path: .init(goalId: goalID)) {
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

  /// Nil when the change is out of date: answered elsewhere, or the plan moved on.
  func decidePlanChange(
    token: String, goalID: String, changeID: String, decision: PlanChangeDecision
  ) async throws -> TodayView.PlanChange? {
    try await clients.perform(token: token) { client in
      switch try await client.decidePlanChange(
        path: .init(goalId: goalID, changeId: changeID),
        body: .json(
          .init(
            status: .init(rawValue: decision.rawValue) ?? .declined,
            timeZone: TimeZone.current.identifier)))
      {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .conflict:
        return nil
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      default:
        throw APIError.unavailable
      }
    }
  }

  func prepareLessons(token: String, goalID: String) async throws {
    try await OnboardingAPI(clients: clients).prepareLessons(goalID: goalID, token: token)
  }

  func answerUploadRequest(token: String, goalID: String, sourceIDs: [String]) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.createResearch(
        body: .json(.init(goalId: goalID, sourceIds: sourceIDs)))
      {
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

  func dismissUploadRequest(token: String, goalID: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.dismissGoalUploadRequest(path: .init(goalId: goalID)) {
      case .noContent:
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

/// Nil for `STUDY_DAY_RETRYABLE`, which the API answers when the plan changed while the day opened.
private func retryable<Value>(_ problem: APIProblem) throws -> Value? {
  guard problem.error.code == "STUDY_DAY_RETRYABLE" else {
    throw APIError.unavailable
  }

  return nil
}

/// The API asks for one more try after `STUDY_DAY_RETRYABLE`, in a request of its own.
private func sendingAgainIfRetryable<Value>(_ send: () async throws -> Value?) async throws
  -> Value
{
  if let value = try await send() {
    return value
  }

  guard let value = try await send() else {
    throw APIError.unavailable
  }

  return value
}
