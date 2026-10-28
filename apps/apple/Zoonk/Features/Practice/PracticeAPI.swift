import Foundation
import OpenAPIRuntime

/// A practice request the server refused for a reason the screen says (transport, sign-in and
/// missing resources stay `APIError`).
enum PracticeAPIError: Error, Equatable, Sendable {
  case conflict(code: String?)
  case dailyLimitReached
  case invalid(code: String?)
  case limitReached
  case plusRequired
}

/// A generation POST (test-out, focus test, challenge questions): ready now, or a run writing them.
enum PracticeGenerationStart: Equatable {
  case generating(generationId: String?)
  case nothingToSkip
  case ready
}

/// A session answer's outcome: graded, already answered, or the block isn't active anymore.
enum StudyAnswerOutcome: Equatable {
  case alreadyAnswered
  case answered(PracticeFeedback)
  case blockNotActive
}

/// A chapter test-out's questions, as the test asks them.
struct TestOutTest: Equatable {
  var needsItems: [String]
  var passMark: Double
  var questions: [PracticeQuestion]
  var trueFalseLabels: PracticeTrueFalseLabels
}

enum TestOutLoad: Equatable {
  case nothingToSkip
  case plusRequired
  case test(TestOutTest)
}

/// A focus test's questions, area by area.
struct FocusTestQuestions: Equatable {
  var areas: [String]
  var needsItems: [String]
  var questions: [PracticeQuestion]
  var questionsPerArea: Int
  var trueFalseLabels: PracticeTrueFalseLabels
}

/// One saved mistake to drill, with its questions (the original first).
struct MistakePracticeEntry: Equatable, Identifiable {
  var cause: Components.Schemas.MistakeCause?
  var drill: PracticeDrill
  var mistakeId: String
  var questions: [PracticeQuestion]
  var snapshotQuestion: String
  var snapshotAnswer: String?

  var id: String { mistakeId }
}

struct MistakePracticeSet: Equatable {
  var entries: [MistakePracticeEntry]
  var trueFalseLabels: PracticeTrueFalseLabels
}

/// A mistake practice answer's grade.
struct MistakePracticeGrade: Equatable {
  var answerId: String
  var correctAnswer: PracticeAnswer?
  var explanation: String?
  var fixed: Bool
  var fixedMistakeIds: [String]
  var isCorrect: Bool
  var isStillOpen: Bool
  var reached: PracticeReached
  var trap: String?
}

/// A language goal's pattern noticed in recent mistakes, or the note that they were only typos.
struct NoticedPattern: Equatable, Sendable {
  let id: String
  let isTypos: Bool
  let title: String
}

/// A checkpoint with its questions read as practice questions.
struct CheckpointLoad: Equatable {
  var checkpoint: Components.Schemas.Checkpoint
  var questions: [PracticeQuestion]
  var trueFalseLabels: PracticeTrueFalseLabels
}

/// The practice screens' requests, over the generated client. Each takes the session's bearer and
/// returns practice models; generated payloads that inline the same schema several times are read
/// once through `PracticeJSON`.
struct PracticeAPI: Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  private var timeZone: String { TimeZone.current.identifier }

  // MARK: Question blocks

  func studyBlock(token: String, sessionId: String, blockId: String) async throws
    -> QuestionBlockDetail
  {
    try await perform(token) { client in
      switch try await client.getStudyBlock(path: .init(sessionId: sessionId, blockId: blockId)) {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func startStudyBlock(token: String, sessionId: String, blockId: String) async throws {
    try await perform(token) { client in
      switch try await client.createStudyBlockStart(
        path: .init(sessionId: sessionId, blockId: blockId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok: return
      case .unauthorized: throw APIError.unauthorized
      case .forbidden: throw PracticeAPIError.dailyLimitReached
      case .conflict(let response):
        throw PracticeAPIError.conflict(code: try? response.body.json.error.code)
      default: throw APIError.unavailable
      }
    }
  }

  func answerStudy(
    token: String, sessionId: String, blockId: String, itemId: String, answer: PracticeAnswer,
    durationMs: Int
  ) async throws -> StudyAnswerOutcome {
    let body = Components.Schemas.StudyAnswerInput(
      answer: try PracticeJSON.recode(answer), durationMs: min(durationMs, 3_600_000),
      itemId: itemId,
      timeZone: timeZone)

    return try await perform(token) { client in
      switch try await client.createStudyAnswer(
        path: .init(sessionId: sessionId, blockId: blockId), body: .json(body))
      {
      case .ok(let response): return .answered(try PracticeJSON.recode(try response.body.json))
      case .unauthorized: throw APIError.unauthorized
      case .conflict(let response):
        return (try? response.body.json.error.code) == "ALREADY_ANSWERED"
          ? .alreadyAnswered : .blockNotActive
      default: throw APIError.unavailable
      }
    }
  }

  func finishStudyBlock(token: String, sessionId: String, blockId: String) async throws
    -> Components.Schemas.StudyBlockCompletion
  {
    try await perform(token) { client in
      switch try await client.createStudyBlockCompletion(
        path: .init(sessionId: sessionId, blockId: blockId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      case .conflict(let response):
        throw PracticeAPIError.conflict(code: try? response.body.json.error.code)
      case .unprocessableContent(let response):
        throw PracticeAPIError.invalid(code: try? response.body.json.error.code)
      default: throw APIError.unavailable
      }
    }
  }

  func stopSession(token: String, sessionId: String) async throws {
    try await perform(token) { client in
      switch try await client.createStudySessionStop(
        path: .init(sessionId: sessionId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok: return
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Mistakes

  func mistakes(token: String, goalId: String?, fixed: Bool, cursor: String?) async throws
    -> Components.Schemas.MistakeList
  {
    try await perform(token) { client in
      switch try await client.listCurrentUserMistakes(
        query: .init(
          goalId: goalId, limit: 50, status: fixed ? .fixed : .open, timeZone: timeZone,
          cursor: cursor))
      {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func mistakePractice(token: String, goalId: String?, skillId: String?) async throws
    -> MistakePracticeSet
  {
    try await perform(token) { client in
      switch try await client.getCurrentUserMistakePractice(
        query: .init(goalId: goalId, skillId: skillId, timeZone: timeZone))
      {
      case .ok(let response):
        let practice = try response.body.json

        return MistakePracticeSet(
          entries: try practice.practice.map { entry in
            MistakePracticeEntry(
              cause: entry.cause?.value1,
              drill: try PracticeJSON.recode(entry.drill),
              mistakeId: entry.mistakeId,
              questions: try entry.questions.map { try PracticeJSON.recode($0) },
              snapshotQuestion: entry.snapshot.question,
              snapshotAnswer: entry.snapshot.answer)
          },
          trueFalseLabels: .init(practice.trueFalseLabels.value1))
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func answerMistake(
    token: String, mistakeId: String, itemId: String, answer: PracticeAnswer, durationMs: Int,
    attemptId: String, runAnswerIds: [String], goalId: String?
  ) async throws -> MistakePracticeGrade {
    let body = Components.Schemas.MistakePracticeAnswerInput(
      answer: try PracticeJSON.recode(answer), durationMs: min(durationMs, 3_600_000),
      itemId: itemId,
      attemptId: attemptId, run: .init(answerIds: runAnswerIds, goalId: goalId), timeZone: timeZone)

    return try await perform(token) { client in
      switch try await client.createMistakePracticeAnswer(
        path: .init(mistakeId: mistakeId), body: .json(body))
      {
      case .ok(let response):
        let grade = try response.body.json

        return MistakePracticeGrade(
          answerId: grade.answerId,
          correctAnswer: try? PracticeJSON.recode(grade.correctAnswer),
          explanation: grade.explanation,
          fixed: grade.fixed,
          fixedMistakeIds: grade.fixedMistakeIds,
          isCorrect: grade.isCorrect,
          isStillOpen: grade.mistakeStatus.value1 == .open,
          reached: try PracticeJSON.recode(grade.reached),
          trap: grade.trap)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func finishMistakePractice(token: String, answerIds: [String], ended: Bool, goalId: String?)
    async throws
    -> Components.Schemas.MistakePracticeCompletion
  {
    let body = Components.Schemas.MistakePracticeFinishInput(
      answerIds: answerIds, ended: ended, goalId: goalId, timeZone: timeZone)

    return try await perform(token) { client in
      switch try await client.createMistakePracticeCompletion(body: .json(body)) {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Patterns

  func pattern(token: String, patternId: String) async throws -> Components.Schemas.MistakePattern {
    try await perform(token) { client in
      switch try await client.getMistakePattern(path: .init(patternId: patternId)) {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      case .notFound, .unprocessableContent: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func practicePattern(token: String, patternId: String, answers: [String], requestId: String)
    async throws
    -> Components.Schemas.MistakePatternPracticeResult
  {
    try await perform(token) { client in
      switch try await client.practiceMistakePattern(
        path: .init(patternId: patternId),
        body: .json(.init(answers: answers, requestId: requestId, timeZone: timeZone)))
      {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func dismissPattern(token: String, patternId: String) async throws {
    try await perform(token) { client in
      switch try await client.dismissMistakePattern(path: .init(patternId: patternId)) {
      case .noContent: return
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Test-out

  func testOut(token: String, goalId: String, chapterId: String) async throws -> TestOutLoad {
    try await perform(token) { client in
      switch try await client.getChapterTestOut(path: .init(goalId: goalId, chapterId: chapterId)) {
      case .ok(let response):
        guard let test = try response.body.json.value1 else { return .nothingToSkip }

        return .test(
          TestOutTest(
            needsItems: test.needsItems, passMark: test.passMark,
            questions: try test.questions.map { try PracticeJSON.recode($0) },
            trueFalseLabels: .init(test.trueFalseLabels)))
      case .code402: return .plusRequired
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func writeTestOut(token: String, goalId: String, chapterId: String) async throws
    -> PracticeGenerationStart
  {
    try await perform(token) { client in
      switch try await client.createChapterTestOutGeneration(
        path: .init(goalId: goalId, chapterId: chapterId))
      {
      case .ok(let response):
        guard let generation = try response.body.json.value1 else { return .nothingToSkip }
        return generation.status == .ready
          ? .ready : .generating(generationId: generation.generationId)
      case .accepted(let response):
        return .generating(generationId: try response.body.json.generationId)
      case .code402: throw PracticeAPIError.plusRequired
      case .forbidden, .tooManyRequests: throw PracticeAPIError.limitReached
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func submitTestOut(
    token: String, goalId: String, chapterId: String, answers: [PracticeChoiceAnswer],
    requestId: String
  ) async throws -> Components.Schemas.ChapterTestOutResult? {
    let body = Components.Schemas.ChapterTestOutInput(
      answers: try answers.map { try $0.input }, requestId: requestId, timeZone: timeZone)

    return try await perform(token) { client in
      switch try await client.submitChapterTestOut(
        path: .init(goalId: goalId, chapterId: chapterId), body: .json(body))
      {
      case .ok(let response): return try response.body.json.value1
      case .code402: throw PracticeAPIError.plusRequired
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  /// Puts back the lessons a passed test-out skipped, through the plan change it made.
  func undoPlanChange(token: String, goalId: String, changeId: String) async throws {
    try await perform(token) { client in
      switch try await client.decidePlanChange(
        path: .init(goalId: goalId, changeId: changeId),
        body: .json(.init(status: .undone, timeZone: timeZone)))
      {
      case .ok: return
      case .unauthorized: throw APIError.unauthorized
      case .conflict: throw PracticeAPIError.conflict(code: nil)
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Focus test

  func focusTest(token: String, goalId: String) async throws -> FocusTestQuestions {
    try await perform(token) { client in
      switch try await client.getFocusTest(path: .init(goalId: goalId)) {
      case .ok(let response):
        let test = try response.body.json

        return FocusTestQuestions(
          areas: test.areas, needsItems: test.needsItems,
          questions: try test.questions.map { try PracticeJSON.recode($0) },
          questionsPerArea: test.questionsPerArea,
          trueFalseLabels: .init(test.trueFalseLabels))
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func writeFocusTest(token: String, goalId: String) async throws -> PracticeGenerationStart {
    try await perform(token) { client in
      switch try await client.createFocusTestGeneration(path: .init(goalId: goalId)) {
      case .ok(let response):
        let generation = try response.body.json
        return generation.status == .ready
          ? .ready : .generating(generationId: generation.generationId)
      case .accepted(let response):
        return .generating(generationId: try response.body.json.generationId)
      case .code402: throw PracticeAPIError.plusRequired
      case .forbidden, .tooManyRequests: throw PracticeAPIError.limitReached
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func submitFocusTest(token: String, goalId: String, answers: [PracticeChoiceAnswer]) async throws
    -> Components.Schemas.FocusTestResult
  {
    let body = Components.Schemas.FocusTestInput(
      answers: try answers.map { try $0.input }, timeZone: timeZone)

    return try await perform(token) { client in
      switch try await client.submitFocusTest(path: .init(goalId: goalId), body: .json(body)) {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Challenges and checkpoints

  func challenge(token: String, planItemId: String) async throws -> Components.Schemas.Challenge {
    try await perform(token) { client in
      switch try await client.getChallenge(
        path: .init(planItemId: planItemId), query: .init(timeZone: timeZone))
      {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func writeChallenge(token: String, planItemId: String) async throws -> PracticeGenerationStart {
    try await perform(token) { client in
      switch try await client.createChallengeGeneration(path: .init(planItemId: planItemId)) {
      case .ok(let response):
        let generation = try response.body.json
        return generation.status == .ready
          ? .ready : .generating(generationId: generation.generationId)
      case .accepted(let response):
        return .generating(generationId: try response.body.json.generationId)
      case .code402: throw PracticeAPIError.plusRequired
      case .forbidden, .tooManyRequests: throw PracticeAPIError.limitReached
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func startChallenge(token: String, planItemId: String, afterWriting: Bool) async throws
    -> Components.Schemas.ChallengeStart
  {
    try await perform(token) { client in
      switch try await client.startChallenge(
        path: .init(planItemId: planItemId),
        body: .json(.init(afterWriting: afterWriting ? true : nil, timeZone: timeZone)))
      {
      case .ok(let response): return try response.body.json
      case .code402: throw PracticeAPIError.plusRequired
      case .forbidden: throw PracticeAPIError.dailyLimitReached
      case .conflict(let response):
        throw PracticeAPIError.conflict(code: try? response.body.json.error.code)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func moveChallenge(token: String, planItemId: String) async throws
    -> Components.Schemas.ChallengeMove
  {
    try await perform(token) { client in
      switch try await client.moveChallenge(
        path: .init(planItemId: planItemId), body: .json(.init(timeZone: timeZone)))
      {
      case .ok(let response): return try response.body.json
      case .unprocessableContent(let response):
        // Why the plan refused the move: moveBeforeNextMonday, mockCollision, badMove, ...
        throw PracticeAPIError.invalid(code: try? response.body.json.error.details.reason)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func undoChallengeMove(token: String, planItemId: String, changeId: String) async throws
    -> Components.Schemas.ChallengeMoveUndo
  {
    try await perform(token) { client in
      switch try await client.undoChallengeMove(
        path: .init(planItemId: planItemId, changeId: changeId), query: .init(timeZone: timeZone))
      {
      case .ok(let response): return try response.body.json
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func checkpoint(token: String, blockId: String) async throws -> CheckpointLoad {
    try await perform(token) { client in
      switch try await client.getCheckpoint(path: .init(blockId: blockId)) {
      case .ok(let response):
        let checkpoint = try response.body.json

        return CheckpointLoad(
          checkpoint: checkpoint,
          questions: try checkpoint.questions.map { try PracticeJSON.recode($0) },
          trueFalseLabels: .init(checkpoint.trueFalseLabels))
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Generations

  /// Follows the run writing questions (started by the learner's tap) until its ready step; a
  /// step that errors, or a stream that ends without it, fails the wait.
  func waitForQuestions(token: String, generationId: String?, readyStep: String) async throws {
    guard let generationId else { return }

    for try await event in clients.generationEvents(id: generationId, token: token) {
      if event.step == readyStep, event.status == "completed" { return }
      if event.status == "error" { throw APIError.unavailable }
    }

    throw APIError.unavailable
  }

  // MARK: Notebook pattern

  /// The pattern the notebook offers for a goal: a language goal's noticed pattern, or none.
  func notebookPattern(token: String, goalId: String) async throws -> NoticedPattern? {
    try await perform(token) { client in
      switch try await client.getGoalMistakePattern(path: .init(goalId: goalId)) {
      case .ok(let response):
        return try response.body.json.pattern.map {
          NoticedPattern(id: $0.id, isTypos: $0.kind == .typos, title: $0.title)
        }
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  // MARK: Transport

  /// Runs a generated call; refusals the screens name pass through, the rest map like every
  /// feature API's (`apiError(from:)`).
  private func perform<Output: Sendable>(
    _ token: String, operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
    } catch let error as PracticeAPIError {
      throw error
    } catch {
      throw apiError(from: error)
    }
  }
}

/// One answer of a run graded at its end (a test-out, a focus test), with how long it took.
struct PracticeChoiceAnswer: Equatable, Codable {
  var answer: PracticeAnswer
  var durationMs: Int
  var itemId: String

  var input: Components.Schemas.ItemAnswerInput {
    get throws {
      .init(
        answer: try PracticeJSON.recode(answer), durationMs: min(durationMs, 3_600_000),
        itemId: itemId)
    }
  }
}

extension PracticeTrueFalseLabels {
  init(_ labels: Components.Schemas.TrueFalseLabels) {
    self = labels == .rightWrong ? .rightWrong : .trueFalse
  }
}
