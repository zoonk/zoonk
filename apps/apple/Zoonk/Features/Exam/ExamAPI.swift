import Foundation
import OpenAPIRuntime

enum MockStartOutcome: Equatable, Sendable {
  typealias Limit = Components.Schemas.AnytimeMock.LimitPayload

  case started(id: String)
  case needsQuestions
  /// `availableAt`: when the full mock fits, once a monthly cap shortened it.
  case short(examQuestions: Int, limit: Limit?, availableAt: Date?, minutes: Int, questions: Int)
  case notEnoughQuestions
  case plusRequired
  case refused(HelpLimit)
  /// A written test past the day's extra grades: it can start again on `returnsOn`.
  case writingLimitReached(returnsOn: String)
}

enum MockQuestionsStart: Equatable, Sendable {
  case ready
  case preparing
  case writing(generationId: String)
  case refused(HelpLimit)
  /// The day's extra writing allowance is used until `returnsOn`.
  case writingLimitReached(returnsOn: String)
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
  case graded(WritingResult)
  case blockNotActive
}

/// A draft save: saved, or another device saved first and this is the draft it left.
enum WritingDraftSave: Equatable, Sendable {
  case saved(WritingDraft)
  case conflict(WritingDraft)
  /// The answer was sent already; there's no draft left to save.
  case closed
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

  /// Every kind goes as one JSON object; the generated client picks the matching schema (a written
  /// test is its own, the written tasks of one exam day).
  private static func body<Payload: Decodable>(_ shape: MockShape) throws -> Payload {
    try PracticeJSON.recode(ShapeBody(area: shape.area, day: shape.day, kind: shape.kind.rawValue))
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

  /// `afterWriting` on the start that follows a questions run, so the server never asks for more.
  func startMock(
    token: String, goalId: String, shape: MockShape, acceptFewer: Bool, afterWriting: Bool = false
  ) async throws -> MockStartOutcome {
    let body = Components.Schemas.AnytimeMockInput(
      shape: try Self.body(shape), acceptFewer: acceptFewer,
      afterWriting: afterWriting ? true : nil)

    return try await clients.perform(token: token, sendingNull: Self.shapeNulls) { client in
      let started: Components.Schemas.AnytimeMock

      switch try await client.startAnytimeMock(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): started = try response.body.json
      case .created(let response): started = try response.body.json
      case .code402: return .plusRequired
      case .tooManyRequests(let response):
        return .writingLimitReached(returnsOn: try response.body.json.returnsOn)
      case .unprocessableContent(let response):
        let code = try? response.body.json.error.code
        if code == "NOT_ENOUGH_QUESTIONS" { return .notEnoughQuestions }
        throw APIError.unavailable
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }

      switch started.status {
      case .started, .running:
        guard let id = started.id else { throw APIError.unavailable }
        return .started(id: id)
      case .needsQuestions:
        return .needsQuestions
      case .short:
        return .short(
          examQuestions: started.examQuestions ?? 0, limit: started.limit,
          availableAt: started.availableAt, minutes: started.minutes ?? 0,
          questions: started.questions ?? 0)
      }
    }
  }

  /// Only from a learner's tap: a run may write the questions.
  func requestMockQuestions(token: String, goalId: String, shape: MockShape) async throws
    -> MockQuestionsStart
  {
    let body = Components.Schemas.MockQuestionsInput(shape: try Self.body(shape))

    return try await clients.perform(token: token, sendingNull: Self.shapeNulls) { client in
      let generation: Components.Schemas.MockQuestionsGeneration

      switch try await client.createMockQuestionsGeneration(
        path: .init(goalId: goalId), body: .json(body))
      {
      case .ok(let response): generation = try response.body.json
      case .accepted(let response): generation = try response.body.json
      case .tooManyRequests(let response):
        let refusal = voiceRefusal(status: 429, error: try? response.body.json)

        // The day's extra writing is used: the written test's questions wait for that day.
        if refusal.code == "USAGE_LIMIT_REACHED",
          let returnsOn = (refusal.details?.value as? [String: (any Sendable)?])?["returnsOn"]
            as? String
        {
          return .writingLimitReached(returnsOn: returnsOn)
        }

        return try refused(refusal)
      case .forbidden(let response):
        return try refused(voiceRefusal(status: 403, error: try? response.body.json))
      case .code402(let response):
        return try refused(voiceRefusal(status: 402, error: try? response.body.json))
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }

      switch generation.status {
      case .ready: return .ready
      case .preparing: return .preparing
      case .generating:
        guard let generationId = generation.generationId else { throw APIError.unavailable }
        return .writing(generationId: generationId)
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

  /// A refusal without a help limit is a failure.
  private func refused(_ refusal: VoiceRefusal) throws -> MockQuestionsStart {
    guard let limit = refusal.limit else { throw APIError.unavailable }
    return .refused(limit)
  }

  /// A run that ends before the questions are ready fails the wait.
  func waitForQuestions(token: String, generationId: String) async throws {
    for try await event in clients.generationEvents(id: generationId, token: token)
    where event.step == "mockQuestionsReady" && event.status == "completed" {
      return
    }

    throw APIError.unavailable
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

  /// The written test's answers were admitted when it started, so grading is never refused.
  func gradeEssays(token: String, blockId: String) async throws {
    try await performLong(token: token) { client in
      switch try await client.gradeMockEssays(
        path: .init(blockId: blockId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok: return
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

  /// Only from a learner's tap: it admits the grading, or starts writing the question. A rewrite
  /// names the graded answer it starts from; anything else replays the block's start.
  func startWriting(token: String, blockId: String, previousAttemptId: String? = nil)
    async throws -> WritingStart
  {
    try await clients.perform(token: token) { client in
      switch try await client.startWriting(
        path: .init(blockId: blockId), body: .json(.init(previousAttemptId: previousAttemptId)))
      {
      case .ok(let response): return try WritingStartWire.recode(try response.body.json)
      case .accepted(let response): return try WritingStartWire.recode(try response.body.json)
      case .tooManyRequests(let response):
        return try WritingStartWire.recode(try response.body.json)
      case .forbidden: return .signUpRequired
      case .conflict: return .unavailable
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: return .failed
      }
    }
  }

  /// "Write now": the learner's own extra block for a written task, the same unfinished one on a
  /// repeat. Its start follows as the same tap.
  func createWritingBlock(token: String, goalId: String, taskKey: String?) async throws -> String {
    try await clients.perform(token: token) { client in
      switch try await client.createWritingBlock(
        path: .init(goalId: goalId), body: .json(.init(taskKey: taskKey)))
      {
      case .ok(let response): return try response.body.json.blockId
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Saved over `revision`; a newer draft saved elsewhere comes back as the conflict.
  func saveWritingDraft(token: String, blockId: String, draft: WritingDraft) async throws
    -> WritingDraftSave
  {
    let body = Components.Schemas.SaveWritingDraft(
      admissionId: draft.admissionId, revision: draft.revision, text: draft.text)

    return try await clients.perform(token: token) { client in
      switch try await client.saveWritingDraft(path: .init(blockId: blockId), body: .json(body)) {
      case .ok(let response): return .saved(try PracticeJSON.recode(try response.body.json))
      case .conflict(let response):
        guard let current: WritingDraft = try? PracticeJSON.recode(try response.body.json) else {
          return .closed
        }
        return .conflict(current)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func writingAttempt(token: String, attemptId: String) async throws -> WritingAttempt? {
    try await clients.perform(token: token) { client in
      switch try await client.getWritingAttempt(path: .init(attemptId: attemptId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .notFound: return nil
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Only from a learner's tap, under the admission its start issued. Sending the same admission
  /// again replays its grade.
  func submitEssay(
    token: String, blockId: String, admissionId: String, text: String, durationMs: Int
  ) async throws -> EssaySubmission {
    let body = Components.Schemas.EssaySubmissionInput(
      admissionId: admissionId, durationMs: min(max(durationMs, 0), 86_400_000), text: text,
      timeZone: timeZone)

    return try await performLong(token: token) { client in
      switch try await client.submitEssay(path: .init(blockId: blockId), body: .json(body)) {
      case .ok(let response): return .graded(try PracticeJSON.recode(try response.body.json))
      case .conflict: return .blockNotActive
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}

private struct ShapeBody: Encodable {
  let area: String?
  let day: Int?
  let kind: String

  private enum CodingKeys: String, CodingKey { case area, day, kind }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(area, forKey: .area)
    try container.encode(day, forKey: .day)
    try container.encode(kind, forKey: .kind)
  }
}

/// `WritingStart` on the wire: one object whatever its status.
struct WritingStartWire: Decodable {
  let admissionId: String?
  let returnsOn: String?
  let runId: String?
  let status: String
  let task: WritingStart.Task?

  static func recode(_ payload: some Encodable) throws -> WritingStart {
    let wire: Self = try PracticeJSON.recode(payload)

    switch (wire.status, wire.admissionId, wire.runId, wire.returnsOn) {
    case ("ready", let id?, _, _): return .ready(admissionId: id)
    case ("writing", _, let run?, _): return .writing(generationId: run)
    case ("limitReached", _, _, let day?): return .limitReached(returnsOn: day, task: wire.task)
    default: throw APIError.unavailable
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
