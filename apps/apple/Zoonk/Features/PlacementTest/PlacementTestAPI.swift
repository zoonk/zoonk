import Foundation

/// A part of the test taken from the plan that closed: what it skipped, and either the next part
/// waiting (`attempt`) or the test's `result`.
struct PlacementPartEnd: Equatable, Sendable {
  let attempt: PlacementAttempt?
  let lessonsSkipped: Int
  let result: PlacementTestResult?
}

enum PlacementPartOutcome: Equatable, Sendable {
  case finished(PlacementPartEnd)
  /// Another device already closed the part or started a newer test.
  case stale
}

/// A language level's short test: a few questions at that level, in reading and listening.
struct LevelTestOut: Decodable, Equatable, Sendable {
  struct Result: Decodable, Equatable, Sendable {
    let finishedAt: Date
    let lessonsSkipped: Int
  }

  /// A test-out question, as practice shows it, with the skill it checks.
  struct Question: Decodable, Equatable, Sendable {
    let question: PracticeQuestion
    let skill: LevelTest.Skill

    init(from decoder: any Decoder) throws {
      question = try PracticeQuestion(from: decoder)
      skill = try decoder.container(keyedBy: CodingKeys.self).decode(
        LevelTest.Skill.self, forKey: .skill)
    }

    private enum CodingKeys: String, CodingKey { case skill }
  }

  let answered: Int
  let attemptId: String
  let level: String
  let next: Question?
  /// Its questions are still being written: read it again in a moment.
  let preparing: Bool
  let result: Result?
  /// Zero when the level has too few questions to test.
  let total: Int
}

private struct PlacementSittingBody: Encodable {
  let length: PlacementLength
  let timeZone = TimeZone.current.identifier
}

private struct PlacementPartBody: Encodable {
  let attemptId: String
  let part: Int
  let fromScratch = false
  let timeZone = TimeZone.current.identifier
}

private struct PlacementPartCompletion: Decodable {
  let attempt: PlacementAttempt?
  let partLessonsSkipped: Int?
  let result: PlacementTestResult?
}

private struct LevelTestOutAnswerBody: Encodable {
  let answer: PracticeAnswer
  let attemptId: String
  let durationMs: Int
  let itemId: String
  let timeZone = TimeZone.current.identifier
}

extension OnboardingAPI {
  /// Opens a test of this length, or the next part of the open one; asked again, it answers with
  /// the one already open.
  func startPlacementTest(goalID: String, length: PlacementLength, token: String) async throws
    -> GoalPlacement
  {
    let body = try PracticeJSON.recode(
      PlacementSittingBody(length: length), as: Components.Schemas.PlacementSittingInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.createPlacementSitting(path: .init(goalId: goalID), body: .json(body))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// Closes a part of the test taken from the plan and applies what it skipped.
  func finishPlacementPart(goalID: String, attemptID: String, part: Int, token: String)
    async throws -> PlacementPartOutcome
  {
    let body = try PracticeJSON.recode(
      PlacementPartBody(attemptId: attemptID, part: part),
      as: Components.Schemas.PlacementCompletionInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.completeGoalPlacement(path: .init(goalId: goalID), body: .json(body))
    }

    switch output {
    case .ok(let response):
      let completion = try PracticeJSON.recode(
        try response.body.json, as: PlacementPartCompletion.self)
      return .finished(
        PlacementPartEnd(
          attempt: completion.attempt, lessonsSkipped: completion.partLessonsSkipped ?? 0,
          result: completion.result))
    case .conflict:
      return .stale
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// Read-only: the test as it stands, an open attempt included.
  func languageTest(goalID: String, attemptID: String?, token: String) async throws -> LevelTest {
    let output = try await clients.perform(token: token) { client in
      try await client.getLanguageLevelTest(
        path: .init(goalId: goalID), query: .init(attemptId: attemptID))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  /// Opens a level test of this length taken from the plan; asked again, it answers with the open one.
  func startLanguageTest(goalID: String, length: PlacementLength, token: String) async throws
    -> LevelTest
  {
    let output = try await clients.perform(token: token) { client in
      try await client.startLanguageLevelTest(
        path: .init(goalId: goalID),
        body: .json(.init(length: length == .quick ? .quick : .wholeCourse)))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// The ranges it found; nil for a test with too few answers to place.
  func finishLanguageTest(goalID: String, attemptID: String?, token: String) async throws
    -> PlacementTestResult?
  {
    let output = try await clients.perform(token: token) { client in
      try await client.finishLanguageLevelTest(
        path: .init(goalId: goalID), body: .json(.init(attemptId: attemptID)))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.result.map { try PracticeJSON.recode($0) }
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func levelTestOut(goalID: String, attemptID: String, token: String) async throws -> LevelTestOut {
    let output = try await clients.perform(token: token) { client in
      try await client.getLanguageLevelTestOut(
        path: .init(goalId: goalID), query: .init(attemptId: attemptID))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func startLevelTestOut(goalID: String, level: String, token: String) async throws
    -> LevelTestOut
  {
    let body = try PracticeJSON.recode(
      ["level": level], as: Components.Schemas.StartLanguageLevelTestOutInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.startLanguageLevelTestOut(path: .init(goalId: goalID), body: .json(body))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func answerLevelTestOut(
    goalID: String, attemptID: String, itemID: String, answer: PracticeAnswer, durationMs: Int,
    token: String
  ) async throws -> LevelTestOut {
    let body = try PracticeJSON.recode(
      LevelTestOutAnswerBody(
        answer: answer, attemptId: attemptID, durationMs: durationMs, itemId: itemID),
      as: Components.Schemas.LanguageLevelTestOutAnswerInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.answerLanguageLevelTestOut(path: .init(goalId: goalID), body: .json(body))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func finishLevelTestOut(goalID: String, attemptID: String, token: String) async throws
    -> LevelTestOut
  {
    let output = try await clients.perform(token: token) { client in
      try await client.finishLanguageLevelTestOut(
        path: .init(goalId: goalID), body: .json(.init(attemptId: attemptID)))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }
}
