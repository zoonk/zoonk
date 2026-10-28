import Foundation
import OpenAPIRuntime

/// A Library lesson as the player reads it.
struct PlayableLesson: Hashable, Sendable {
  let id: String
  let title: String
  let language: String
  let targetLanguage: String?
  let chapterTitle: String?
  let steps: [LessonStep]
  /// The summary card, each idea in one sentence, for the menu once the lesson is done.
  let summaryIdeas: [String]
  let tutorSuggestions: [Components.Schemas.LessonTutorSuggestion]
}

/// The lesson's outline when its screens can't show yet.
struct LessonOutline: Hashable, Sendable {
  let id: String
  let title: String
  let description: String
  let estimatedMinutes: Int
}

enum LessonLoad: Hashable, Sendable {
  case ready(PlayableLesson)
  /// The screens are still being written.
  case notGenerated(LessonOutline)
  /// A visitor: the screens load only with a session, a guest's included.
  case sessionRequired(LessonOutline)
}

struct LessonRunStart: Hashable, Sendable {
  let runId: String
  /// When this sitting's run started: earlier answers came from sittings before it.
  let startedAt: Date
  let answers: [LessonRunAnswer]
  let hyperdrive: LessonHyperdriveStart
  let optionalStepIds: [String]
  let support: LessonPlayerState.LessonSupport?
}

/// Where a public lesson fits, for the end of a guest's lesson.
struct LessonFit: Hashable, Sendable {
  struct Course: Hashable, Sendable {
    let id: String
    let title: String
    let chapterCount: Int
    let minutes: Int
    /// Where "Build my plan" starts the course: this lesson's chapter, or nil for its beginning.
    let startChapterId: String?
  }

  let chapterTitle: String
  let lessonNumber: Int
  let lessonCount: Int
  let course: Course?
}

enum LessonCheckOutcome: Hashable, Sendable {
  case checked(LessonStepResult)
  /// Worth sending again (the connection, the server).
  case failed
  /// The session ended: sending again with it never works.
  case unauthorized
  /// Never worth sending again: the run finished, or the answer doesn't fit the screen.
  case refused
}

enum LessonCompletionOutcome: Hashable, Sendable {
  case completed(LessonCompletionSummary)
  /// An answer the screens show never reached the server.
  case incomplete
  /// The session ended: sending again with it never works.
  case unauthorized
  case failed
}

/// Whether an unwritten lesson can be written now, on the learner's tap.
enum LessonWritingOutcome: Hashable, Sendable {
  case ready
  case writing
  /// Every draft was held back by its checks; plans moved on without it.
  case setAside
  case refused(LessonRunRefusal)
  case failed
}

enum AnswerExplanationOutcome: Hashable, Sendable {
  case explained(String)
  case refused(LessonRunRefusal)
  case failed
}

/// The lesson player's calls to the public API.
struct LessonPlayerAPI: Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func getLesson(id: String, token: String?) async throws -> LessonLoad {
    let output = try await clients.perform(token: token) {
      try await $0.getLibraryLesson(path: .init(lessonId: id))
    }

    switch output {
    case .ok(let response):
      switch try response.body.json {
      case .case1(let ready):
        let lesson = ready.lesson
        return .ready(
          PlayableLesson(
            id: lesson.id, title: lesson.title, language: lesson.language,
            targetLanguage: lesson.targetLanguage, chapterTitle: lesson.chapter?.title,
            steps: lesson.steps, summaryIdeas: lesson.summaryIdeas,
            tutorSuggestions: ready.tutorSuggestions))
      case .case2(let outline):
        let lesson = outline.lesson
        return .notGenerated(
          LessonOutline(
            id: lesson.id, title: lesson.title, description: lesson.description,
            estimatedMinutes: lesson.estimatedMinutes))
      case .case3(let outline):
        let lesson = outline.lesson
        return .sessionRequired(
          LessonOutline(
            id: lesson.id, title: lesson.title, description: lesson.description,
            estimatedMinutes: lesson.estimatedMinutes))
      }
    case .notFound, .badRequest:
      throw APIError.notFound
    case .internalServerError, .undocumented:
      throw APIError.network
    }
  }

  /// Starts a run, or resumes the open one (within half an hour) with its answers.
  func startLesson(id: String, studySessionId: String?, token: String) async -> Result<
    LessonRunStart, LessonRunRefusal
  > {
    let body = Components.Schemas.LibraryLessonStartInput(
      studySessionId: studySessionId, timeZone: TimeZone.current.identifier)

    guard
      let output = try? await clients.perform(
        token: token,
        operation: {
          try await $0.createLibraryLessonStart(
            path: .init(lessonId: id), body: .json(body))
        })
    else {
      return .failure(.failed)
    }

    switch output {
    case .created(let response):
      guard let run = try? response.body.json else {
        return .failure(.failed)
      }

      return .success(
        LessonRunStart(
          runId: run.runId,
          startedAt: run.startedAt,
          answers: run.answers.map {
            LessonRunAnswer(stepId: $0.stepId, isCorrect: $0.isCorrect, answeredAt: $0.answeredAt)
          },
          hyperdrive: LessonHyperdriveStart(
            knownStepIds: Set(run.hyperdrive.knownStepIds), streak: run.hyperdrive.streak),
          optionalStepIds: run.optionalStepIds ?? [],
          support: run.support.flatMap {
            LessonPlayerState.LessonSupport(rawValue: $0.value1.rawValue)
          }))
    case .unauthorized:
      return .failure(.unauthorized)
    case .notFound:
      return .failure(.notFound)
    case .code402(let response):
      return .failure(Self.refusal(try? response.body.json, status: 402))
    case .forbidden(let response):
      return .failure(Self.refusal(try? response.body.json, status: 403))
    case .tooManyRequests(let response):
      return .failure(Self.refusal(try? response.body.json, status: 429))
    case .badRequest, .internalServerError, .undocumented:
      return .failure(.failed)
    }
  }

  func checkStep(
    stepId: String,
    answer: LessonAnswer,
    attemptId: String,
    durationMs: Int,
    runId: String,
    usedHelp: Bool,
    token: String
  ) async -> LessonCheckOutcome {
    let body = Components.Schemas.LessonStepCheckInput(
      answer: answer, attemptId: attemptId, durationMs: min(durationMs, 3_600_000), runId: runId,
      timeZone: TimeZone.current.identifier, usedHelp: usedHelp)

    guard
      let output = try? await clients.perform(
        token: token,
        operation: {
          try await $0.createStepCheck(
            path: .init(stepId: stepId), body: .json(body))
        })
    else {
      return .failed
    }

    switch output {
    case .ok(let response):
      guard let result = try? response.body.json else {
        return .failed
      }

      var verdict = LessonStepResult(
        isCorrect: result.isCorrect, answerText: nil, correctAnswer: result.correctAnswer,
        feedback: result.feedback)
      verdict.checked = result.checked
      verdict.corrections = result.corrections.map { .init(wrong: $0.wrong, right: $0.right) }
      verdict.keyPoints = result.keyPoints?.map { .init(text: $0.text, met: $0.met) }
      verdict.score = result.score
      verdict.spelling = result.spelling
      verdict.nextReviewAt = result.nextReviewAt
      verdict.savedMistake = result.savedMistake
      return .checked(verdict)
    case .conflict, .unprocessableContent, .badRequest, .notFound:
      return .refused
    case .unauthorized:
      return .unauthorized
    case .internalServerError, .undocumented:
      return .failed
    }
  }

  func completeLesson(
    id: String, runId: String, skippedWritingStepIds: [String], token: String
  ) async -> LessonCompletionOutcome {
    let body = Components.Schemas.LibraryLessonCompletionInput(
      runId: runId,
      skippedWritingStepIds: skippedWritingStepIds.isEmpty ? nil : skippedWritingStepIds,
      timeZone: TimeZone.current.identifier)

    guard
      let output = try? await clients.perform(
        token: token,
        operation: {
          try await $0.createLibraryLessonCompletion(
            path: .init(lessonId: id), body: .json(body))
        })
    else {
      return .failed
    }

    switch output {
    case .ok(let response):
      guard let completion = try? response.body.json else {
        return .failed
      }

      return .completed(
        LessonCompletionSummary(
          brainPower: completion.brainPower, totalBrainPower: completion.totalBrainPower,
          correctCount: completion.correctCount, incorrectCount: completion.incorrectCount,
          energyDelta: completion.energyDelta, seconds: completion.seconds,
          isFirstCompletion: completion.isFirstCompletion,
          nextReviewAt: completion.nextReviewAt,
          reachedLevel: completion.reached.level?.level))
    case .unprocessableContent:
      return .incomplete
    case .unauthorized:
      return .unauthorized
    case .badRequest, .notFound, .internalServerError, .undocumented:
      return .failed
    }
  }

  /// Whether an unwritten lesson is being written, failed, or hasn't started.
  func getReadiness(id: String, token: String) async throws
    -> Components.Schemas.LessonReadiness.StatusPayload
  {
    let output = try await clients.perform(token: token) {
      try await $0.getLibraryLessonReadiness(
        path: .init(lessonId: id))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.status
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound, .badRequest:
      throw APIError.notFound
    case .internalServerError, .undocumented:
      throw APIError.network
    }
  }

  /// Writes the lesson now. Only on the learner's tap: it runs AI.
  func writeLesson(id: String, token: String) async -> LessonWritingOutcome {
    guard
      let output = try? await clients.perform(
        token: token,
        operation: {
          try await $0.createLibraryLessonGeneration(
            path: .init(lessonId: id))
        })
    else {
      return .failed
    }

    switch output {
    case .ok(let response):
      return (try? response.body.json.status) == .ready ? .ready : .writing
    case .accepted(let response):
      return (try? response.body.json.status) == .ready ? .ready : .writing
    case .conflict:
      return .setAside
    case .code402(let response):
      return .refused(Self.refusal(try? response.body.json, status: 402))
    case .forbidden(let response):
      return .refused(Self.refusal(try? response.body.json, status: 403))
    case .tooManyRequests(let response):
      return .refused(Self.refusal(try? response.body.json, status: 429))
    case .unauthorized:
      return .refused(.unauthorized)
    case .notFound:
      return .refused(.notFound)
    case .badRequest, .internalServerError, .undocumented:
      return .failed
    }
  }

  /// "Explain my answer" on a wrong typed answer. Only on the learner's tap: it may run AI.
  func explainAnswer(stepId: String, answer: String, token: String) async
    -> AnswerExplanationOutcome
  {
    guard
      let output = try? await clients.perform(
        token: token,
        operation: {
          try await $0.createStepAnswerExplanation(
            path: .init(stepId: stepId), body: .json(.init(answer: answer)))
        })
    else {
      return .failed
    }

    switch output {
    case .ok(let response):
      return (try? response.body.json.explanation).map { .explained($0) } ?? .failed
    case .code402(let response):
      return .refused(Self.refusal(try? response.body.json, status: 402))
    case .forbidden(let response):
      return .refused(Self.refusal(try? response.body.json, status: 403))
    case .tooManyRequests(let response):
      return .refused(Self.refusal(try? response.body.json, status: 429))
    case .unauthorized:
      return .refused(.unauthorized)
    case .badRequest, .notFound, .unprocessableContent, .internalServerError, .undocumented:
      return .failed
    }
  }

  /// The colleagues' names for a challenge, in the case's slot order.
  func getChallengeTeam(lessonId: String, token: String) async -> [String] {
    let output = try? await clients.perform(token: token) {
      try await $0.getChallengeTeam(path: .init(lessonId: lessonId))
    }

    guard case .ok(let response) = output, let team = try? response.body.json else {
      return []
    }

    return team.members.map(\.name)
  }

  /// Where a public lesson fits, for the end of a guest's lesson; nil outside a public chapter.
  func getLessonFit(id: String, token: String?) async -> LessonFit? {
    let output = try? await clients.perform(token: token) {
      try await $0.getLibraryLessonFit(path: .init(lessonId: id))
    }

    guard case .ok(let response) = output, let fit = try? response.body.json else {
      return nil
    }

    return LessonFit(
      chapterTitle: fit.chapter.title, lessonNumber: fit.chapter.lessonNumber,
      lessonCount: fit.chapter.lessonCount,
      course: fit.course.map {
        LessonFit.Course(
          id: $0.id, title: $0.title, chapterCount: $0.chapterCount, minutes: $0.minutes,
          startChapterId: $0.startChapterId)
      })
  }

  /// Writes the lesson's personal example lines (every screen's, in one call). Only after the
  /// learner's first action in a lesson: it may run AI.
  func requestExampleLines(stepId: String, token: String) async {
    _ = try? await clients.perform(token: token) {
      try await $0.requestCurrentUserStepExampleLine(path: .init(stepId: stepId))
    }
  }

  /// A screen's saved example line; reading never writes one.
  func getExampleLine(stepId: String, token: String) async -> String? {
    let output = try? await clients.perform(token: token) {
      try await $0.getCurrentUserStepExampleLine(path: .init(stepId: stepId))
    }

    guard case .ok(let response) = output, let line = try? response.body.json.line else {
      return nil
    }

    return line
  }

  /// Lesson sounds stay on until the learner turns them off.
  func getSoundsEnabled(token: String) async -> Bool {
    let output = try? await clients.perform(token: token) {
      try await $0.getCurrentUserLearningProfile()
    }

    guard case .ok(let response) = output, let profile = try? response.body.json else {
      return true
    }

    return profile.profile.soundsEnabled
  }

  // MARK: - Helpers

  /// Reads a refused allowance or AI claim: `USAGE_LIMIT_REACHED` with `details.limit`,
  /// `SLOW_DOWN` with `details.retryAfterSeconds`, `PLUS_REQUIRED`, or a guest's `SIGN_UP_REQUIRED`.
  private static func refusal(_ error: Components.Schemas._Error?, status: Int) -> LessonRunRefusal
  {
    let code = error?.error.code
    let details = error?.error.details?.value as? [String: (any Sendable)?]

    switch code {
    case "PLUS_REQUIRED":
      return .plusRequired
    case "SLOW_DOWN":
      let seconds = (details?["retryAfterSeconds"] ?? nil) as? Int ?? 30
      return .slowDown(retryAfterSeconds: seconds)
    case "SIGN_UP_REQUIRED":
      return .limitReached(tier: .guest, period: .day)
    default:
      let limit = (details?["limit"] ?? nil) as? [String: (any Sendable)?]
      let tierName = (limit?["tier"] ?? nil) as? String
      let periodName = (limit?["period"] ?? nil) as? String
      let tier: LessonRunRefusal.Tier =
        switch tierName ?? (status == 403 ? "guest" : status == 402 ? "free" : "plus") {
        case "guest": .guest
        case "free": .free
        default: .plus
        }
      let period: LessonRunRefusal.Period =
        switch periodName {
        case "month": .month
        case "total": .total
        default: .day
        }
      return .limitReached(tier: tier, period: period)
    }
  }
}
