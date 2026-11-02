import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Refusals the screens explain come back as `VoiceRefusal`; every other failure is an `APIError`.
struct VoiceAPI: Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func answerSpokenStep(
    stepId: String,
    studySessionId: String?,
    recording: VoiceRecording,
    token: String
  ) async throws -> Refusable<Components.Schemas.SpokenAnswerGrade> {
    try await clients.perform(token: token) { client in
      var parts: [Components.Schemas.SpokenAnswerRequest] = [
        .durationMs(.init(payload: .init(body: HTTPBody(String(recording.durationMs))))),
        .timeZone(.init(payload: .init(body: HTTPBody(TimeZone.current.identifier)))),
        .audio(.init(payload: .init(body: HTTPBody(recording.audio)), filename: "answer.m4a")),
      ]

      if let studySessionId {
        parts.insert(.studySessionId(.init(payload: .init(body: HTTPBody(studySessionId)))), at: 0)
      }

      let output = try await client.createSpokenAnswer(
        path: .init(stepId: stepId), body: .multipartForm(.init(parts)))

      switch output {
      case .ok(let response):
        return .done(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .code402(let response):
        return .refused(voiceRefusal(status: 402, error: try? response.body.json))
      case .forbidden(let response):
        return .refused(voiceRefusal(status: 403, error: try? response.body.json))
      case .unprocessableContent(let response):
        return .refused(voiceRefusal(status: 422, error: try? response.body.json))
      case .tooManyRequests(let response):
        return .refused(voiceRefusal(status: 429, error: try? response.body.json))
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func answerPronunciation(
    reviewId: String,
    goalId: String,
    roundId: String,
    recording: VoiceRecording,
    token: String
  ) async throws -> Refusable<Components.Schemas.PronunciationAnswerGrade> {
    try await clients.perform(token: token) { client in
      let parts: [Components.Schemas.PronunciationAnswerRequest] = [
        .durationMs(.init(payload: .init(body: HTTPBody(String(recording.durationMs))))),
        .goalId(.init(payload: .init(body: HTTPBody(goalId)))),
        .roundId(.init(payload: .init(body: HTTPBody(roundId)))),
        .timeZone(.init(payload: .init(body: HTTPBody(TimeZone.current.identifier)))),
        .audio(.init(payload: .init(body: HTTPBody(recording.audio)), filename: "word.m4a")),
      ]

      let output = try await client.answerPronunciationReview(
        path: .init(reviewId: reviewId), body: .multipartForm(.init(parts)))

      switch output {
      case .ok(let response):
        return .done(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .code402(let response):
        return .refused(voiceRefusal(status: 402, error: try? response.body.json))
      case .forbidden(let response):
        return .refused(voiceRefusal(status: 403, error: try? response.body.json))
      case .unprocessableContent(let response):
        return .refused(voiceRefusal(status: 422, error: try? response.body.json))
      case .tooManyRequests(let response):
        return .refused(voiceRefusal(status: 429, error: try? response.body.json))
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func answerLevelTestOutLoud(
    goalId: String,
    recording: VoiceRecording,
    token: String
  ) async throws -> Refusable<Components.Schemas.LanguageLevelTestSpokenResult> {
    try await clients.perform(token: token) { client in
      let parts: [Components.Schemas.LanguageLevelTestSpokenAnswerRequest] = [
        .audio(.init(payload: .init(body: HTTPBody(recording.audio)), filename: "sentence.m4a"))
      ]

      let output = try await client.answerLanguageLevelTestOutLoud(
        path: .init(goalId: goalId), body: .multipartForm(.init(parts)))

      switch output {
      case .ok(let response):
        return .done(try response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .code402(let response):
        return .refused(voiceRefusal(status: 402, error: try? response.body.json))
      case .forbidden(let response):
        return .refused(voiceRefusal(status: 403, error: try? response.body.json))
      case .conflict(let response):
        return .refused(voiceRefusal(status: 409, error: try? response.body.json))
      case .unprocessableContent(let response):
        return .refused(voiceRefusal(status: 422, error: try? response.body.json))
      case .tooManyRequests(let response):
        return .refused(voiceRefusal(status: 429, error: try? response.body.json))
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  /// Only ever on a learner's tap.
  func speechClip(
    text: String,
    language: String,
    personal: Bool,
    token: String
  ) async throws -> URL {
    try await clients.perform(token: token) { client in
      let output = try await client.requestSpeechClip(
        body: .json(.init(language: language, personal: personal, text: text)))

      switch output {
      case .ok(let response):
        guard let url = URL(string: try response.body.json.url) else {
          throw APIError.unavailable
        }

        return url
      case .unauthorized:
        throw APIError.unauthorized
      case .code402(let response):
        throw voiceRefusal(status: 402, error: try? response.body.json)
      case .forbidden(let response):
        throw voiceRefusal(status: 403, error: try? response.body.json)
      case .tooManyRequests(let response):
        throw voiceRefusal(status: 429, error: try? response.body.json)
      case .badRequest, .internalServerError, .serviceUnavailable, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func pronunciationReviews(
    goalId: String,
    token: String
  ) async throws -> Components.Schemas.PronunciationReviews {
    try await clients.perform(token: token) { client in
      switch try await client.listPronunciationReviews(path: .init(goalId: goalId)) {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound, .unprocessableContent:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func completePronunciationRound(
    roundId: String,
    goalId: String,
    token: String
  ) async throws -> Components.Schemas.PronunciationRoundResult {
    try await clients.perform(token: token) { client in
      let output = try await client.completePronunciationRound(
        path: .init(roundId: roundId),
        body: .json(.init(goalId: goalId, timeZone: TimeZone.current.identifier)))

      switch output {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .badRequest, .unprocessableContent, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  /// Nil when no exam's format fits the goal.
  func speakingPaper(goalId: String, token: String) async throws -> Components.Schemas
    .SpeakingPaper?
  {
    try await clients.perform(token: token) { client in
      switch try await client.getSpeakingPaper(path: .init(goalId: goalId)) {
      case .ok(let response):
        return try response.body.json
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        return nil
      case .unprocessableContent(let response):
        throw voiceRefusal(status: 422, error: try? response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}
