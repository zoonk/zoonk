import Foundation

enum MockStartOutcome: Equatable, Sendable {
  case started(id: String)
  /// Its questions are being written: nothing started, and the server keeps the request.
  case preparing
  case plusRequired
}

enum MockStepOutcome: String, Decodable, Sendable {
  case next
  case finished
  case expired
}

enum MockPlanOffer: String, Encodable, Sendable {
  case skip
  case focus
}

enum MockPlanOfferOutcome: Equatable, Sendable {
  enum Reason: String, Decodable, Sendable {
    case alreadyIn
    case cantMove
  }

  case applied(lessonsSkipped: Int)
  case unchanged(Reason?)
}

enum EssaySubmission: Equatable, Sendable {
  case graded(EssayGrade)
  case limitReached
  case signUpRequired
  case blockNotActive
}

struct ExamResultInput: Encodable, Equatable, Sendable {
  var maxScore: Double?
  var passed: Bool?
  var scale: String?
  var score: Double?
}

struct ExamAPI {
  let clients: APIClientFactory

  private var timeZone: String { TimeZone.current.identifier }

  /// A shape's keys are required but nullable.
  /// The API takes every key of a shape: the client leaves out nils, and these go as nulls.
  private static let shapeNulls = ["shape.area", "shape.day"]

  private static func body(_ shape: MockShape) -> Components.Schemas.MockShape {
    let kind: Components.Schemas.MockShape.KindPayload =
      switch shape.kind {
      case .full: .full
      case .half: .half
      case .area: .area
      }

    return .init(area: shape.area, day: shape.day, kind: kind)
  }

  func exam(token: String, goalId: String) async throws -> ExamView? {
    try await clients.perform(token: token) { client in
      switch try await client.getExam(
        path: .init(goalId: goalId), query: .init(timeZone: timeZone))
      {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      // A goal that isn't an exam has no exam page.
      case .notFound, .unprocessableContent: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func reportResult(token: String, goalId: String, input: ExamResultInput) async throws -> Bool {
    let body: Components.Schemas.ExamResultInput = try PracticeJSON.recode(input)

    return try await clients.perform(
      token: token, sendingNull: ["maxScore", "passed", "scale", "score"]
    ) {
      client in
      switch try await client.reportExamResult(
        path: .init(goalId: goalId), query: .init(timeZone: timeZone), body: .json(body))
      {
      case .ok: return true
      case .conflict, .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func mockOptions(token: String, goalId: String) async throws -> MockOptions? {
    try await clients.perform(token: token) { client in
      switch try await client.listMocks(path: .init(goalId: goalId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .notFound, .unprocessableContent: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Only from a learner's tap.
  func startMock(token: String, goalId: String, shape: MockShape) async throws -> MockStartOutcome {
    let body = Components.Schemas.AnytimeMockInput(shape: .init(value1: Self.body(shape)))

    return try await clients.perform(token: token, sendingNull: Self.shapeNulls) { client in
      let started: Components.Schemas.AnytimeMock

      switch try await client.startAnytimeMock(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): started = try response.body.json
      case .created(let response): started = try response.body.json
      case .code402: return .plusRequired
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }

      switch started.status {
      case .started, .running:
        guard let id = started.id else { throw APIError.unavailable }
        return .started(id: id)
      case .preparing:
        return .preparing
      }
    }
  }

  /// Grading is a model call per essay (10 to 25 seconds), which main waits up to 90 seconds for
  /// (120 for a mock's few).
  private func performLong<Output: Sendable>(
    token: String, operation: (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeStreamingClient(token: token))
    } catch {
      throw apiError(from: error)
    }
  }

  func mock(token: String, blockId: String) async throws -> MockView? {
    try await clients.perform(token: token) { client in
      switch try await client.getMock(path: .init(blockId: blockId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .notFound: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// False when refused: its time ran out, or the answer is locked.
  func saveAnswer(token: String, blockId: String, draft: MockDraft) async throws -> Bool {
    let body: Components.Schemas.MockAnswerInput = try PracticeJSON.recode(MockAnswerRequest(draft))

    return try await clients.perform(token: token, sendingNull: ["answer"]) { client in
      switch try await client.saveMockAnswer(path: .init(blockId: blockId), body: .json(body)) {
      case .noContent: return true
      case .conflict, .unprocessableContent: return false
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func submitSection(token: String, blockId: String, section: Int) async throws -> MockStepOutcome?
  {
    try await clients.perform(token: token) { client in
      switch try await client.submitMockSection(
        path: .init(blockId: blockId, section: section), body: .json(.init(timeZone: timeZone)))
      {
      case .ok(let response):
        return MockStepOutcome(rawValue: try response.body.json.status.rawValue)
      // A section already handed in elsewhere: the mock as it stands says where it is.
      case .conflict: return nil
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func finish(token: String, blockId: String) async throws -> MockStepOutcome? {
    try await clients.perform(token: token) { client in
      switch try await client.finishMock(
        path: .init(blockId: blockId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok(let response):
        return MockStepOutcome(rawValue: try response.body.json.status.rawValue)
      case .conflict: return nil
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func endBreak(token: String, blockId: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.endMockBreak(path: .init(blockId: blockId)) {
      // A break that ran out on its own already started the next section.
      case .noContent, .conflict: return
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Nil when no plays were left.
  func recordPlay(token: String, blockId: String, setId: String) async throws -> Int? {
    try await clients.perform(token: token) { client in
      switch try await client.recordMockPlay(
        path: .init(blockId: blockId), body: .json(.init(setId: setId)))
      {
      case .ok(let response): return try response.body.json.played
      case .conflict: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Only from a tap.
  func startSpeaking(token: String, blockId: String, whileWriting: @MainActor () -> Void)
    async throws -> Bool
  {
    try await clients.sendOnceWritten(token: token, whileWriting: whileWriting) {
      try await clients.perform(token: token) { client in
        switch try await client.startMockSpeaking(path: .init(blockId: blockId)) {
        case .ok: return .done(true)
        case .accepted(let response):
          return .writing(generationID: try response.body.json.generationId)
        case .conflict, .code402, .serviceUnavailable: return .done(false)
        case .unauthorized: throw APIError.unauthorized
        default: throw APIError.unavailable
        }
      }
    }
  }

  /// False when today's essay grades ran out first.
  func gradeEssays(token: String, blockId: String) async throws -> Bool {
    try await performLong(token: token) { client in
      switch try await client.gradeMockEssays(
        path: .init(blockId: blockId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok: return true
      case .tooManyRequests: return false
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func adaptPlan(token: String, blockId: String, offer: MockPlanOffer) async throws
    -> MockPlanOfferOutcome
  {
    let body: Components.Schemas.MockPlanOfferInput = try PracticeJSON.recode(
      MockPlanOfferRequest(offer: offer, timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.adaptPlanFromMock(path: .init(blockId: blockId), body: .json(body)) {
      case .ok(let response):
        let result: MockPlanOfferResponse = try PracticeJSON.recode(try response.body.json)
        return result.status == "applied"
          ? .applied(lessonsSkipped: result.lessonsSkipped ?? 0) : .unchanged(result.reason)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func essay(token: String, blockId: String) async throws -> EssayView? {
    try await clients.perform(token: token) { client in
      switch try await client.getEssay(
        path: .init(blockId: blockId), query: .init(timeZone: timeZone))
      {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .notFound: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Only from a learner's tap. A resend under the same `attemptId` joins the first one, so it's
  /// graded once.
  func submitEssay(
    token: String, blockId: String, attemptId: String, text: String, durationMs: Int
  ) async throws -> EssaySubmission {
    let body = Components.Schemas.EssaySubmissionInput(
      attemptId: attemptId, durationMs: min(max(durationMs, 0), 3_600_000), text: text,
      timeZone: timeZone)

    return try await performLong(token: token) { client in
      switch try await client.submitEssay(path: .init(blockId: blockId), body: .json(body)) {
      case .ok(let response): return .graded(try PracticeJSON.recode(try response.body.json))
      case .tooManyRequests: return .limitReached
      case .forbidden: return .signUpRequired
      case .conflict: return .blockNotActive
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}

private struct MockAnswerRequest: Encodable {
  let draft: MockDraft

  init(_ draft: MockDraft) { self.draft = draft }

  private enum CodingKeys: String, CodingKey { case answer, durationMs, flagged, itemId }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    // A blank is an explicit null: the API asks for the key.
    try container.encode(draft.isAnswered ? draft.answer : nil, forKey: .answer)
    try container.encode(min(max(draft.durationMs, 0), 3_600_000), forKey: .durationMs)
    try container.encode(draft.flagged, forKey: .flagged)
    try container.encode(draft.itemId, forKey: .itemId)
  }
}

private struct MockPlanOfferRequest: Encodable {
  let offer: MockPlanOffer
  let timeZone: String
}

private struct MockPlanOfferResponse: Decodable {
  let lessonsSkipped: Int?
  let reason: MockPlanOfferOutcome.Reason?
  let status: String
}
