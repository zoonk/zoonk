import Foundation

/// A change the learner makes in "Adjust plan", in the API's operation shape.
enum PlanEdit: Encodable, Equatable, Sendable {
  case dailyMinutes(Int)
  case targetDate(String)
  /// Minutes for some weekdays (Sunday 0); 0 makes them rest days.
  case weekdayMinutes(Int, weekdays: [Int])

  private enum CodingKeys: String, CodingKey {
    case kind
    case minutes
    case targetDate
    case weekdays
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .dailyMinutes(let minutes):
      try container.encode("setDailyMinutes", forKey: .kind)
      try container.encode(minutes, forKey: .minutes)
    case .targetDate(let date):
      try container.encode("setTargetDate", forKey: .kind)
      try container.encode(date, forKey: .targetDate)
    case .weekdayMinutes(let minutes, let weekdays):
      try container.encode("setWeekdayMinutes", forKey: .kind)
      try container.encode(minutes, forKey: .minutes)
      try container.encode(weekdays, forKey: .weekdays)
    }
  }
}

/// A change the plan made: what it did to the plan's end, and whether today's session follows it.
struct AppliedPlanChange: Decodable, Equatable, Identifiable, Sendable {
  struct Effect: Decodable, Equatable, Sendable {
    let endDateAfter: String?
    let endDateBefore: String?
  }

  let canUndo: Bool
  let effect: Effect?
  let id: String
  /// `changed` when today's session follows the change, `unchanged` when it starts tomorrow.
  let todaySession: String?
}

/// What saving a change came to: applied, or not saved because it wouldn't change anything.
enum PlanChangeOutcome: Equatable, Sendable {
  case applied(AppliedPlanChange)
  /// The date is outside what the plan can reach.
  case invalidDate
  case unchanged
}

private struct PlanChangeRequest: Encodable {
  let operations: [PlanEdit]
  let timeZone: String
}

private struct PlanChangeResult: Decodable {
  let change: AppliedPlanChange?
  let status: String
}

private struct PlanDecision: Encodable {
  let status: String
  let timeZone: String
}

extension PlanAPI {
  func change(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanChangeOutcome {
    let body: Components.Schemas.PlanChangeInput = try PracticeJSON.recode(
      PlanChangeRequest(operations: edits, timeZone: TimeZone.current.identifier))

    return try await clients.perform(token: token) { client in
      switch try await client.createPlanChange(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response):
        let result: PlanChangeResult = try PracticeJSON.recode(try response.body.json)

        guard result.status == "applied", let change = result.change else {
          return .unchanged
        }

        return .applied(change)
      case .unprocessableContent: return .invalidDate
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Undoes the plan's latest change while the plan is still as it left it.
  func undo(token: String, goalId: String, changeId: String) async throws -> Bool {
    let body: Components.Schemas.PlanChangeDecisionInput = try PracticeJSON.recode(
      PlanDecision(status: "undone", timeZone: TimeZone.current.identifier))

    return try await clients.perform(token: token) { client in
      switch try await client.decidePlanChange(
        path: .init(goalId: goalId, changeId: changeId), body: .json(body))
      {
      case .ok: return true
      case .conflict: return false
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }
}

extension PlanStore {
  /// Saves a change from "Adjust plan". It re-plans from today, so the plan, Today and the summary
  /// follow; nil when it didn't go through.
  func change(goalId: String, edits: [PlanEdit]) async -> PlanChangeOutcome? {
    await write { token in
      try await self.api.change(token: token, goalId: goalId, edits: edits)
    } changed: { outcome in
      if case .applied = outcome {
        return true
      }

      return false
    }
  }

  func undo(goalId: String, changeId: String) async -> Bool {
    await write { token in
      try await self.api.undo(token: token, goalId: goalId, changeId: changeId)
    } changed: {
      $0
    } ?? false
  }
}
