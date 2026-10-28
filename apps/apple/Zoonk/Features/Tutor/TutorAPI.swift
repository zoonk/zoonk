import Foundation
import OpenAPIRuntime

protocol TutorAPIClient: Sendable {
  func thread(_ scope: TutorScope, cursor: String?, token: String) async throws -> TutorThreadPage
  func ask(
    _ scope: TutorScope, question: String, suggestion: String?, requestId: String, token: String
  ) async throws -> TutorAskedQuestion
  /// Throws `TutorFailure` when it's refused.
  func answer(questionId: String, token: String) -> AsyncThrowingStream<TutorAnswerEvent, Error>
  func question(id: String, token: String) async throws -> TutorTurn
  func decidePlanChange(
    goalId: String, changeId: String, decision: TutorPlanChangeDecision, token: String
  ) async throws -> Components.Schemas.PlanChange
  func undoMemoryChanges(_ changes: [TutorMemoryChange], token: String) async throws
}

enum TutorPlanChangeDecision: String, Sendable {
  case applied
  case declined
  case undone
}

struct TutorAPI: TutorAPIClient {
  let clients: APIClientFactory

  func thread(_ scope: TutorScope, cursor: String?, token: String) async throws -> TutorThreadPage {
    let thread = try await clients.perform(token: token) { client in
      try await readThread(scope, cursor: cursor, client: client)
    }

    return thread.map(TutorThreadPage.init) ?? .empty
  }

  func ask(
    _ scope: TutorScope, question: String, suggestion: String?, requestId: String, token: String
  ) async throws -> TutorAskedQuestion {
    let request = Components.Schemas.CreateLessonQuestionRequest(
      context: scope.contextInput,
      question: question,
      requestId: requestId,
      suggestion: suggestion.flatMap(
        Components.Schemas.CreateLessonQuestionRequest.SuggestionPayload.init))

    let created = try await clients.perform(token: token) { client in
      try await createQuestion(scope, request: request, client: client)
    }

    return TutorAskedQuestion(
      turn: TutorTurn(created), missionMoment: created.missionMoment?.value1)
  }

  func answer(questionId: String, token: String) -> AsyncThrowingStream<TutorAnswerEvent, Error> {
    AsyncThrowingStream { continuation in
      let task = Task {
        do {
          let output = try await clients.makeStreamingClient(token: token)
            .createLessonQuestionAnswer(path: .init(questionId: questionId))

          let body: HTTPBody

          switch output {
          case .ok(let response):
            body = try response.body.textEventStream
          case .code402(let response):
            throw TutorFailure(refusal: try? response.body.json, fallback: .plusRequired)
          case .forbidden(let response):
            throw TutorFailure(refusal: try? response.body.json, fallback: .failed)
          case .tooManyRequests(let response):
            throw TutorFailure(refusal: try? response.body.json, fallback: .slowDown)
          case .unauthorized:
            throw APIError.unauthorized
          case .notFound:
            throw TutorFailure.gone
          case .badRequest, .conflict, .internalServerError, .undocumented:
            throw TutorFailure.failed
          }

          let chunks = body.asDecodedServerSentEventsWithJSONData(
            of: TutorAnswerChunk.self, while: { $0 != ArraySlice("[DONE]".utf8) })

          for try await chunk in chunks {
            if let event = try chunk.data?.event() {
              continuation.yield(event)
            }
          }

          continuation.finish()
        } catch {
          continuation.finish(throwing: error is TutorFailure ? error : apiError(from: error))
        }
      }

      continuation.onTermination = { _ in
        task.cancel()
      }
    }
  }

  func question(id: String, token: String) async throws -> TutorTurn {
    try await clients.perform(token: token) { client in
      switch try await client.getLessonQuestion(path: .init(questionId: id)) {
      case .ok(let response):
        return TutorTurn(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func decidePlanChange(
    goalId: String, changeId: String, decision: TutorPlanChangeDecision, token: String
  ) async throws -> Components.Schemas.PlanChange {
    try await clients.perform(token: token) { client in
      let output = try await client.decidePlanChange(
        path: .init(goalId: goalId, changeId: changeId),
        body: .json(.init(status: .init(rawValue: decision.rawValue) ?? .declined)))

      switch output {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .conflict, .unprocessableContent, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func undoMemoryChanges(_ changes: [TutorMemoryChange], token: String) async throws {
    try await clients.perform(token: token) { client in
      let output = try await client.createMemoryChangeReversal(
        body: .json(.init(changes: changes.map(\.reversalInput))))

      switch output {
      case .ok:
        return
      case .unauthorized:
        throw APIError.unauthorized
      case .badRequest, .conflict, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

private func readThread(
  _ scope: TutorScope, cursor: String?, client: Client
) async throws -> Components.Schemas.LessonQuestionThread? {
  switch scope {
  case .plan(let goalId):
    let output = try await client.getPlanQuestionThread(
      path: .init(goalId: goalId), query: .init(contextKind: .plan, cursor: cursor))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  case .subject(let goalId, let subjectKey):
    let output = try await client.getSubjectQuestionThread(
      path: .init(goalId: goalId, subjectKey: subjectKey),
      query: .init(contextKind: .subject, cursor: cursor))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  case .chapter(let chapterId):
    let output = try await client.getChapterQuestionThread(
      path: .init(chapterId: chapterId), query: .init(contextKind: .chapter, cursor: cursor))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  case .mock(let blockId):
    let output = try await client.getMockQuestionThread(
      path: .init(blockId: blockId), query: .init(contextKind: .mock, cursor: cursor))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  case .lesson(let lessonId, _), .step(let lessonId, _, _, _):
    let stepId: String? = if case .step(_, let id, _, _) = scope { id } else { nil }
    let output = try await client.getLessonQuestionThread(
      path: .init(lessonId: lessonId),
      query: .init(contextKind: stepId == nil ? .lesson : nil, cursor: cursor, stepId: stepId))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  case .item(let itemId, _, _, _):
    let output = try await client.getItemQuestionThread(
      path: .init(itemId: itemId), query: .init(cursor: cursor))

    switch output {
    case .ok(let response): return try response.body.json?.value1
    case .unauthorized: throw APIError.unauthorized
    case .notFound: throw APIError.notFound
    case .badRequest, .internalServerError, .undocumented: throw APIError.unavailable
    }
  }
}

private func createQuestion(
  _ scope: TutorScope, request: Components.Schemas.CreateLessonQuestionRequest, client: Client
) async throws -> Components.Schemas.CreatedLessonQuestion {
  switch scope {
  case .plan(let goalId):
    return try createdQuestion(
      try await client.createPlanQuestion(path: .init(goalId: goalId), body: .json(request)))
  case .subject(let goalId, let subjectKey):
    return try createdQuestion(
      try await client.createSubjectQuestion(
        path: .init(goalId: goalId, subjectKey: subjectKey), body: .json(request)))
  case .chapter(let chapterId):
    return try createdQuestion(
      try await client.createChapterQuestion(
        path: .init(chapterId: chapterId), body: .json(request)))
  case .mock(let blockId):
    return try createdQuestion(
      try await client.createMockQuestion(path: .init(blockId: blockId), body: .json(request)))
  case .lesson(let lessonId, _), .step(let lessonId, _, _, _):
    return try createdQuestion(
      try await client.createLessonQuestion(path: .init(lessonId: lessonId), body: .json(request)))
  case .item(let itemId, _, _, _):
    return try createdQuestion(
      try await client.createItemQuestion(path: .init(itemId: itemId), body: .json(request)))
  }
}

/// Every create operation answers alike; each has its own generated output type.
private protocol CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion { get throws }
}

private func createdQuestion(_ output: some CreatedQuestionOutput) throws
  -> Components.Schemas.CreatedLessonQuestion
{
  try output.createdQuestion
}

private func createFailure(
  status: Int, error: Components.Schemas._Error?
) -> Error {
  switch status {
  case 401: APIError.unauthorized
  case 403: TutorFailure(refusal: error, fallback: .signUpRequired)
  case 404: TutorFailure.gone
  case 400, 422: TutorFailure.invalid
  default: TutorFailure.failed
  }
}

extension Operations.CreatePlanQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension Operations.CreateSubjectQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension Operations.CreateChapterQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension Operations.CreateMockQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension Operations.CreateLessonQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension Operations.CreateItemQuestion.Output: CreatedQuestionOutput {
  var createdQuestion: Components.Schemas.CreatedLessonQuestion {
    get throws {
      switch self {
      case .created(let response): try response.body.json
      case .badRequest: throw createFailure(status: 400, error: nil)
      case .unauthorized: throw createFailure(status: 401, error: nil)
      case .forbidden(let response):
        throw createFailure(status: 403, error: try? response.body.json)
      case .notFound: throw createFailure(status: 404, error: nil)
      case .conflict: throw TutorFailure.conflict
      case .unprocessableContent: throw createFailure(status: 422, error: nil)
      case .internalServerError, .undocumented: throw createFailure(status: 500, error: nil)
      }
    }
  }
}

extension TutorScope {
  fileprivate var contextInput: Components.Schemas.LessonQuestionContextInput {
    switch self {
    case .plan:
      .case4(.init(kind: .plan))
    case .subject:
      .case4(.init(kind: .subject))
    case .chapter:
      .case4(.init(kind: .chapter))
    case .mock:
      .case4(.init(kind: .mock))
    case .lesson:
      .case1(.init(kind: .lesson))
    case .step(_, let stepId, let stepNumber, _):
      .case2(.init(kind: .step, stepId: stepId, stepNumber: stepNumber))
    case .item(_, let blockId, let answered, _):
      .case5(.init(answered: answered, blockId: blockId, kind: .item))
    }
  }
}

extension TutorThreadPage {
  fileprivate init(_ thread: Components.Schemas.LessonQuestionThread) {
    self.init(
      turns: thread.questions.map(TutorTurn.init),
      hasMore: thread.hasMore,
      nextCursor: thread.nextCursor)
  }
}

extension TutorTurn {
  fileprivate init(_ question: Components.Schemas.LessonQuestion) {
    self.init(
      id: question.id,
      question: question.question,
      answer: question.answer,
      status: Status(rawValue: question.status.rawValue) ?? .failed,
      createdAt: question.createdAt,
      about: About(question.context),
      planChange: question.planChange?.value1,
      toolOffer: question.toolOffer?.value1)
  }

  fileprivate init(_ question: Components.Schemas.CreatedLessonQuestion) {
    self.init(
      id: question.id,
      question: question.question,
      answer: question.answer,
      status: Status(rawValue: question.status.rawValue) ?? .failed,
      createdAt: question.createdAt,
      about: About(question.context),
      planChange: question.planChange?.value1,
      toolOffer: question.toolOffer?.value1)
  }
}

extension TutorTurn.About {
  fileprivate init(_ context: Components.Schemas.LessonQuestion.ContextPayload) {
    switch context {
    case .case1: self = .lesson
    case .case2(let item): self = item.answered ? .answer : .item
    case .case3(let whole): self = Self(whole.kind.rawValue)
    case .case4: self = .step
    case .case5: self = .answer
    }
  }

  fileprivate init(_ context: Components.Schemas.CreatedLessonQuestion.ContextPayload) {
    switch context {
    case .case1: self = .lesson
    case .case2(let item): self = item.answered ? .answer : .item
    case .case3(let whole): self = Self(whole.kind.rawValue)
    case .case4: self = .step
    case .case5: self = .answer
    }
  }

  private init(_ kind: String) {
    switch kind {
    case "chapter": self = .chapter
    case "mock": self = .mock
    case "subject": self = .subject
    default: self = .plan
    }
  }
}

extension TutorMemoryChange {
  fileprivate var reversalInput: Components.Schemas.MemoryChangeReference {
    .init(factId: fact?.id, previousFactId: previous?.id)
  }
}

extension TutorFailure {
  /// `fallback` when the error body names no allowance.
  init(refusal error: Components.Schemas._Error?, fallback: TutorFailure) {
    switch error?.error.code {
    case "SIGN_UP_REQUIRED":
      self = .signUpRequired
    case "SLOW_DOWN":
      self = .slowDown
    case "USAGE_LIMIT_REACHED":
      guard let limit = error?.error.details.flatMap(UsageLimitDetails.init)?.limit,
        let tier = LearnerTier(rawValue: limit.tier)
      else {
        self = fallback
        return
      }

      self = .limitReached(period: limit.period, tier: tier)
    default:
      self = fallback
    }
  }
}

private struct UsageLimitDetails: Decodable {
  struct Limit: Decodable {
    let period: TutorFailure.Period
    let tier: String
  }

  let limit: Limit

  init?(_ container: OpenAPIValueContainer) {
    guard let data = try? JSONEncoder().encode(container),
      let details = try? JSONDecoder().decode(Self.self, from: data)
    else {
      return nil
    }

    self = details
  }
}

/// An AI SDK UI message chunk; chunks the conversation doesn't use decode to nothing.
struct TutorAnswerChunk: Decodable, Hashable, Sendable {
  private let type: String
  private let delta: String?
  private let data: Data?

  private enum CodingKeys: String, CodingKey {
    case type
    case delta
    case data
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    type = try container.decode(String.self, forKey: .type)
    delta = try container.decodeIfPresent(String.self, forKey: .delta)
    data = try container.decodeIfPresent(JSONData.self, forKey: .data)?.data
  }

  /// A malformed data part is skipped; an `error` chunk throws.
  func event() throws -> TutorAnswerEvent? {
    switch type {
    case "text-delta":
      return delta.map(TutorAnswerEvent.text)
    case "finish":
      return .finish
    case "error":
      throw TutorFailure.failed
    case "data-saved-answer":
      return decode(SavedAnswer.self).map { .savedAnswer($0.answer) }
    case "data-plan-change":
      return decode(Components.Schemas.PlanChange.self).map(TutorAnswerEvent.planChange)
    case "data-plan-changes-replaced":
      return decode(ReplacedChanges.self).map { .planChangesReplaced($0.ids) }
    case "data-tool-offer":
      return decode(Components.Schemas.TutorToolOffer.self).map(TutorAnswerEvent.toolOffer)
    case "data-memory":
      return decode([TutorMemoryChange].self).map(TutorAnswerEvent.memory)
    default:
      return nil
    }
  }

  private func decode<Value: Decodable>(_ type: Value.Type) -> Value? {
    guard let data else {
      return nil
    }

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601WithFractionalSecondsOrNot
    return try? decoder.decode(type, from: data)
  }

  private struct SavedAnswer: Decodable {
    let answer: String
  }

  private struct ReplacedChanges: Decodable {
    let ids: [String]
  }
}

/// Raw JSON, so each part decodes it as its own type.
private struct JSONData: Decodable {
  let data: Data

  init(from decoder: any Decoder) throws {
    let value = try OpenAPIValueContainer(from: decoder)
    data = try JSONEncoder().encode(value)
  }
}

extension JSONDecoder.DateDecodingStrategy {
  /// The API's instants, with or without fractional seconds.
  fileprivate static let iso8601WithFractionalSecondsOrNot = custom { decoder in
    let text = try decoder.singleValueContainer().decode(String.self)

    if let date = try? Date(
      text, strategy: .iso8601.year().month().day().time(includingFractionalSeconds: true))
    {
      return date
    }

    return try Date(text, strategy: .iso8601)
  }
}
