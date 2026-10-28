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

/// Asking for a far topic's outline: a run is writing it, or the learner's plan reached its limit.
enum OutlineRequest: Equatable, Sendable {
  case limit
  case started
}

/// The Plan's reads and writes. `PlanAPI` calls the API; tests use a stub.
protocol PlanAPIClient: Sendable {
  func plan(token: String, goalId: String) async throws -> GoalPlan
  func planChanged(token: String, goalId: String, since: Date) async throws -> Bool
  func syllabus(token: String, goalId: String) async throws -> GoalSyllabus
  func standing(token: String, goalId: String) async throws -> GoalStanding
  func languageStanding(token: String, goalId: String) async throws -> LanguageStanding
  func languageUnits(token: String, goalId: String) async throws -> LanguageUnitsOverview
  func studyNext(token: String, goalId: String) async throws -> StudyNext?
  func resumeChangesPlan(token: String, goalId: String) async throws -> Bool
  func setStatus(token: String, goalId: String, status: GoalStatusChange) async throws
    -> GoalStatusOutcome
  func change(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanChangeOutcome
  func preview(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanEffect?
  func undo(token: String, goalId: String, changeId: String) async throws -> Bool
  func chooseExamOption(token: String, goalId: String, group: String, subject: String)
    async throws -> PlanChangeOutcome
  func chooseTools(
    token: String, goalId: String, tools: [String], choice: ToolChoice, system: String?
  ) async throws -> PlanChangeOutcome
  func timeToCover(token: String, goalId: String) async throws -> PlanTimeToCover
  func basesAdvice(token: String, goalId: String) async throws -> PlanBasesAdvice
  func continueAtNextLevel(token: String, goalId: String) async throws -> Bool
  func skipAlphabet(token: String, goalId: String) async throws -> Bool
  func goalGenerationId(token: String, goalId: String) async throws -> String?
  func restartGeneration(token: String, goalId: String) async throws -> String?
  func generationEvents(id: String, token: String) -> AsyncThrowingStream<GenerationEvent, Error>
  func outline(token: String, goalId: String, skillId: String) async throws -> SkillOutline
  func createOutline(token: String, goalId: String, skillId: String) async throws -> OutlineRequest
}

private struct PlanChangeRequest: Encodable {
  let operations: [PlanEdit]
  let timeZone: String
}

private struct PlanChangeResult: Decodable {
  let change: AppliedPlanChange?
  let status: String
}

private struct PlanChangePreview: Decodable {
  let effect: PlanEffect?
}

private struct PlanDecision: Encodable {
  let status: String
  let timeZone: String
}

private struct ExamChoiceRequest: Encodable {
  let group: String
  let subject: String
  let timeZone: String
}

private struct ToolChoiceRequest: Encodable {
  let choice: String
  let system: String?
  let timeZone: String
  let tools: [String]
}

private struct FieldMapNext: Decodable {
  let next: StudyNext?
}

struct PlanAPI: PlanAPIClient {
  let clients: APIClientFactory

  private var timeZone: String { TimeZone.current.identifier }

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

  func languageStanding(token: String, goalId: String) async throws -> LanguageStanding {
    try await clients.perform(token: token) { client in
      switch try await client.getLanguageProgress(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound, .unprocessableContent: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func languageUnits(token: String, goalId: String) async throws -> LanguageUnitsOverview {
    try await clients.perform(token: token) { client in
      switch try await client.getLanguageUnits(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound, .unprocessableContent: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// What to study next once the plan is over, from the goal's map.
  func studyNext(token: String, goalId: String) async throws -> StudyNext? {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalMap(path: .init(goalId: goalId)) {
      case .ok(let response):
        let map: FieldMapNext = try PracticeJSON.recode(try response.body.json)
        return map.next
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

  func change(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanChangeOutcome {
    let body: Components.Schemas.PlanChangeInput = try PracticeJSON.recode(
      PlanChangeRequest(operations: edits, timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.createPlanChange(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): return try Self.outcome(PracticeJSON.recode(try response.body.json))
      case .unprocessableContent: return .invalid
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// What a change would do, without saving it.
  func preview(token: String, goalId: String, edits: [PlanEdit]) async throws -> PlanEffect? {
    let body: Components.Schemas.PlanChangeInput = try PracticeJSON.recode(
      PlanChangeRequest(operations: edits, timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.previewPlanChange(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response):
        let preview: PlanChangePreview = try PracticeJSON.recode(try response.body.json)
        return preview.effect
      case .unprocessableContent: return nil
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Undoes the plan's latest change while the plan is still as it left it.
  func undo(token: String, goalId: String, changeId: String) async throws -> Bool {
    let body: Components.Schemas.PlanChangeDecisionInput = try PracticeJSON.recode(
      PlanDecision(status: "undone", timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.decidePlanChange(
        path: .init(goalId: goalId, changeId: changeId), body: .json(body))
      {
      case .ok: return true
      case .conflict, .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func chooseExamOption(token: String, goalId: String, group: String, subject: String)
    async throws -> PlanChangeOutcome
  {
    let body: Components.Schemas.ExamChoiceInput = try PracticeJSON.recode(
      ExamChoiceRequest(group: group, subject: subject, timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.createPlanExamChoice(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): return try Self.outcome(PracticeJSON.recode(try response.body.json))
      case .unprocessableContent: return .invalid
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func chooseTools(
    token: String, goalId: String, tools: [String], choice: ToolChoice, system: String?
  ) async throws -> PlanChangeOutcome {
    let body: Components.Schemas.PlanToolChoiceInput = try PracticeJSON.recode(
      ToolChoiceRequest(choice: choice.rawValue, system: system, timeZone: timeZone, tools: tools))

    return try await clients.perform(token: token) { client in
      switch try await client.createPlanToolChoice(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): return try Self.outcome(PracticeJSON.recode(try response.body.json))
      case .unprocessableContent: return .invalid
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Plans the goal at each daily time to find the one that covers it: only when the learner asks.
  func timeToCover(token: String, goalId: String) async throws -> PlanTimeToCover {
    try await clients.perform(token: token) { client in
      switch try await client.findPlanTimeToCover(path: .init(goalId: goalId), body: .json(.init()))
      {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func basesAdvice(token: String, goalId: String) async throws -> PlanBasesAdvice {
    try await clients.perform(token: token) { client in
      switch try await client.createPlanBasesAdvice(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Starts the next level of the plan's course; the goal's plan is built again.
  func continueAtNextLevel(token: String, goalId: String) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.continueGoalAtNextLevel(path: .init(goalId: goalId)) {
      case .created: return true
      case .conflict, .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// "I can already read it": the alphabet lesson stops opening the sessions.
  func skipAlphabet(token: String, goalId: String) async throws -> Bool {
    try await clients.perform(token: token) { client in
      switch try await client.skipAlphabetIntro(path: .init(goalId: goalId)) {
      case .noContent: return true
      case .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// The run building the goal's plan; nil when there's none.
  func goalGenerationId(token: String, goalId: String) async throws -> String? {
    try await clients.perform(token: token) { client in
      switch try await client.getGoalGeneration(path: .init(goalId: goalId)) {
      case .ok(let response): return try response.body.json.generationId
      case .notFound: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// "Try again": starts the goal's run again, only from the learner's tap.
  func restartGeneration(token: String, goalId: String) async throws -> String? {
    try await clients.perform(token: token) { client in
      switch try await client.createGoalGeneration(path: .init(goalId: goalId)) {
      case .accepted(let response): return try response.body.json.generationId
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func generationEvents(id: String, token: String) -> AsyncThrowingStream<GenerationEvent, Error> {
    clients.generationEvents(id: id, token: token)
  }

  func outline(token: String, goalId: String, skillId: String) async throws -> SkillOutline {
    try await clients.perform(token: token) { client in
      switch try await client.getSkillOutline(path: .init(goalId: goalId, skillId: skillId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Outlines a far topic's lessons, from the learner's tap.
  func createOutline(token: String, goalId: String, skillId: String) async throws -> OutlineRequest
  {
    try await clients.perform(token: token) { client in
      switch try await client.createSkillOutlineGeneration(
        path: .init(goalId: goalId, skillId: skillId))
      {
      case .ok, .accepted: return .started
      case .code402, .forbidden, .tooManyRequests: return .limit
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  private static func outcome(_ result: PlanChangeResult) -> PlanChangeOutcome {
    guard result.status == "applied", let change = result.change else {
      return .unchanged
    }

    return .applied(change)
  }
}
