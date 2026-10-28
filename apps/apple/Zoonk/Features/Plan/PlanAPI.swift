import Foundation

/// What changing a goal's status came to; resuming can hit the free plan's one active goal.
enum GoalStatusOutcome: Equatable, Sendable {
  case failed
  case limitReached
  case saved
}

/// The goal statuses the Plan's "…" sets.
enum GoalStatusChange: String, Sendable {
  case active
  case archived
  case paused
}

/// The Plan's reads and the goal's writes, on the app's shared client.
struct PlanAPI: Sendable {
  let clients: APIClientFactory

  func plan(token: String, goalId: String) async throws -> GoalPlan {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalPlan(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Whether the plan changed since `since` (lessons written, studied, re-planned): the cheap
  /// question asked before reading the plan again.
  func planChanged(token: String, goalId: String, since: Date) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.getPlanChangedSince(
        path: .init(goalId: goalId), query: .init(since: since))
      {
      case .ok(let response): return try response.body.json.changed
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func syllabus(token: String, goalId: String) async throws -> GoalSyllabus {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalSyllabus(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func standing(token: String, goalId: String) async throws -> GoalStanding {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalProgress(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Whether resuming the paused goal changes its plan, asked before Resume.
  func resumeChangesPlan(token: String, goalId: String) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.previewGoalResume(path: .init(goalId: goalId)) {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func setStatus(token: String, goalId: String, status: GoalStatusChange) async throws
    -> GoalStatusOutcome
  {
    try await clients.perform(token: token) { client in
      let status = Components.Schemas.GoalUpdateInput.StatusPayload(rawValue: status.rawValue)
      switch try await client.updateGoal(
        path: .init(goalId: goalId), body: .json(.init(status: status)))
      {
      case .ok: return .saved
      case .unauthorized: throw APIError.unauthorized
      case .tooManyRequests: return .limitReached
      default: return .failed
      }
    }
  }
}
