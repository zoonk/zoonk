import Foundation
import OpenAPIRuntime

enum MockStartOutcome: Equatable, Sendable {
  case started(id: String)
  /// Its questions are being written: nothing started, and the server keeps the request.
  case preparing
  case plusRequired
  case refused(HelpLimit)
  /// A written test past the day's extra grades: it can start again on `returnsOn`.
  case writingLimitReached(returnsOn: String)
  /// The written test's questions depend on an exam choice the learner hasn't made.
  case needsChoice(choiceGroups: [String])
}

/// The exam choices a refused written or full mock waits for (`EXAM_CHOICE_REQUIRED`).
func pendingChoice(_ error: Components.Schemas._Error?) -> [String]? {
  let refusal = voiceRefusal(status: 409, error: error)
  guard refusal.code == "EXAM_CHOICE_REQUIRED" else { return nil }

  let groups = (refusal.details?.value as? [String: (any Sendable)?])?["choiceGroups"]
  return (groups as? [(any Sendable)?])?.compactMap { $0 as? String }
}

/// The run writing the paper of a mock being prepared (main's `MockWriting`).
struct MockWriting: Equatable, Sendable {
  enum Status: Sendable {
    case writing
    /// Its run starts in a few seconds: ask again.
    case starting
    /// Nothing is writing it now; the daily preparation goes on with it.
    case none
  }

  let generationId: String?
  let namespace: String?
  let status: Status
}

enum MockStepOutcome: String, Decodable, Sendable {
  case next
  case finished
  case expired
}

enum MockPlanOfferOutcome: Equatable, Sendable {
  case applied(lessonsSkipped: Int)
  case unchanged
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

  /// Only reads: it never starts a run.
  func mockWriting(token: String, goalId: String, planItemId: String?) async throws -> MockWriting {
    try await clients.perform(token: token) { client in
      switch try await client.getMockWriting(
        path: .init(goalId: goalId), query: .init(planItemId: planItemId))
      {
      case .ok(let response):
        let writing = try response.body.json

        let status: MockWriting.Status =
          switch writing.status {
          case .unrecognized: throw APIError.unavailable
          case .writing: .writing
          case .starting: .starting
          case .none: .none
          }

        return MockWriting(
          generationId: writing.generationId, namespace: writing.namespace, status: status)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  /// Only from a learner's tap.
  func startMock(token: String, goalId: String, shape: MockShape) async throws -> MockStartOutcome {
    let body = Components.Schemas.AnytimeMockInput(shape: try Self.body(shape))

    return try await clients.perform(token: token, sendingNull: Self.shapeNulls) { client in
      let started: Components.Schemas.AnytimeMock

      switch try await client.startAnytimeMock(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): started = try response.body.json
      case .created(let response): started = try response.body.json
      case .code402: return .plusRequired
      case .forbidden(let response):
        let refusal = voiceRefusal(status: 403, error: try? response.body.json)
        if refusal.code == "SIGN_UP_REQUIRED" { return .refused(.signUpRequired) }
        throw APIError.unavailable
      case .tooManyRequests(let response):
        return .writingLimitReached(returnsOn: try response.body.json.returnsOn)
      case .conflict(let response):
        guard let groups = pendingChoice(try? response.body.json) else {
          throw APIError.unavailable
        }
        return .needsChoice(choiceGroups: groups)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }

      switch started.status {
      case .unrecognized: throw APIError.unavailable
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

  /// Skips the lessons the mock showed the learner knows.
  func skipKnownLessons(token: String, blockId: String) async throws -> MockPlanOfferOutcome {
    let body: Components.Schemas.MockPlanOfferInput = try PracticeJSON.recode(
      MockPlanOfferRequest(offer: "skip", timeZone: timeZone))

    return try await clients.perform(token: token) { client in
      switch try await client.adaptPlanFromMock(path: .init(blockId: blockId), body: .json(body)) {
      case .ok(let response):
        let result: MockPlanOfferResponse = try PracticeJSON.recode(try response.body.json)
        return result.status == "applied"
          ? .applied(lessonsSkipped: result.lessonsSkipped ?? 0) : .unchanged
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
  let unit: WritingPrompt.Unit?

  static func recode(_ payload: some Encodable) throws -> WritingStart {
    let wire: Self = try PracticeJSON.recode(payload)

    switch (wire.status, wire.admissionId, wire.runId, wire.returnsOn) {
    case ("ready", let id?, _, _): return .ready(admissionId: id)
    case ("writing", _, let run?, _): return .writing(generationId: run, unit: wire.unit)
    case ("limitReached", _, _, let day?): return .limitReached(returnsOn: day, task: wire.task)
    default: throw APIError.unavailable
    }
  }
}

private struct MockAnswerRequest: Encodable {
  let draft: MockDraft

  init(_ draft: MockDraft) { self.draft = draft }

  private enum CodingKeys: String, CodingKey { case answer, durationMs, edit, flagged, itemId }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    // A blank is an explicit null: the API asks for the key.
    try container.encode(draft.isAnswered ? draft.answer : nil, forKey: .answer)
    try container.encode(min(max(draft.durationMs, 0), 24 * 60 * 60 * 1000), forKey: .durationMs)
    try container.encodeIfPresent(draft.edit, forKey: .edit)
    try container.encode(draft.unsure, forKey: .flagged)
    try container.encode(draft.itemId, forKey: .itemId)
  }
}

private struct MockPlanOfferRequest: Encodable {
  let offer: String
  let timeZone: String
}

private struct MockPlanOfferResponse: Decodable {
  let lessonsSkipped: Int?
  let status: String
}
