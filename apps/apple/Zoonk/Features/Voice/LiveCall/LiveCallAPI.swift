import Foundation
import OpenAPIRuntime

typealias LanguageConversation = Components.Schemas.LanguageConversation
typealias CompletedLanguageConversation = Components.Schemas.CompletedLanguageConversation
typealias ConversationTurn = Components.Schemas.LanguageConversationTurn

extension LanguageConversation {
  /// The exam task an `examSpeaking` call practices.
  var speakingTask: Components.Schemas.ExamSpeakingTask? { examTask?.value1 }
  /// The exam a speaking mock follows.
  var mockExam: Components.Schemas.SpeakingMockExam? { exam?.value1 }
}

/// Why the plan's call time is used: today's, this month's, or (`total`) a guest's plan has none.
struct CallLimit: Equatable, Sendable {
  let period: HelpLimit.Period
  let tier: LearnerTier
}

/// Reserving a call: its setup, or why it can't be made now, as main's `readConnectionRefusal`
/// reads the API's refusal.
enum CallReservation: Equatable, Sendable {
  case ready(Components.Schemas.LanguageConversationSetup)
  case limit(CallLimit)
  case callInProgress
  case callsPaused
  case ended
  case plusRequired
  case previousConnectionClosing
  case failed

  init(refusal: VoiceRefusal) {
    let details = refusal.details?.value as? [String: (any Sendable)?]
    let period = (details?["period"] ?? nil) as? String

    switch refusal.code {
    case "CALLS_PAUSED":
      self = .callsPaused
    case "CALL_IN_PROGRESS":
      self = .callInProgress
    case "PREVIOUS_CONNECTION_CLOSING":
      self = .previousConnectionClosing
    case "PLUS_REQUIRED":
      self = .plusRequired
    case "CONVERSATION_ENDED":
      self = .ended
    case "CONVERSATION_LIMIT_REACHED":
      let tier = ((details?["tier"] ?? nil) as? String).flatMap(LearnerTier.init)

      if let period = period.flatMap(HelpLimit.Period.init), let tier {
        self = .limit(CallLimit(period: period, tier: tier))
      } else {
        self = .failed
      }
    case "CONNECTION_LIMIT_REACHED":
      self = period == "conversation" ? .ended : .limit(CallLimit(period: .day, tier: .plus))
    case "SIGN_UP_REQUIRED":
      self = .limit(CallLimit(period: .total, tier: .guest))
    default:
      self = .failed
    }
  }
}

/// Saving a finished call: it with its result, or why it wasn't saved.
enum CallCompletion: Equatable, Sendable {
  case completed(CompletedLanguageConversation)
  case ended
  case takenOver
  case failed
}

/// What a live call asks of the API, one capability per request: start a conversation, read it,
/// reserve a connection, trade the WebRTC offer for GPT-Live's answer, hang up, check the goals,
/// and save it.
struct LiveCallAPI: Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  /// Creates a conversation the learner tapped to start.
  func start(
    _ input: Components.Schemas.LanguageConversationStartInput,
    token: String
  ) async throws -> String {
    try await clients.perform(token: token) { client in
      switch try await client.startLanguageConversation(body: .json(input)) {
      case .created(let response):
        return try response.body.json.conversationId
      case .unauthorized:
        throw APIError.unauthorized
      case .notFound:
        throw APIError.notFound
      case .code402(let response):
        throw voiceRefusal(status: 402, error: try? response.body.json)
      case .forbidden(let response):
        throw voiceRefusal(status: 403, error: try? response.body.json)
      case .conflict(let response):
        throw voiceRefusal(status: 409, error: try? response.body.json)
      case .unprocessableContent(let response):
        throw voiceRefusal(status: 422, error: try? response.body.json)
      case .tooManyRequests(let response):
        throw voiceRefusal(status: 429, error: try? response.body.json)
      case .serviceUnavailable(let response):
        throw voiceRefusal(status: 503, error: try? response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func conversation(id: String, token: String) async throws -> LanguageConversation {
    try await clients.perform(token: token) { client in
      switch try await client.getLanguageConversation(path: .init(conversationId: id)) {
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

  /// Reserves the call; `takeover` ends the learner's other open call first.
  func connect(conversationId: String, takeover: Bool, token: String) async -> CallReservation {
    do {
      return try await clients.perform(token: token) { client in
        let output = try await client.connectLanguageConversation(
          path: .init(conversationId: conversationId), body: .json(.init(takeover: takeover)))

        switch output {
        case .created(let response):
          return .ready(try response.body.json)
        case .unauthorized:
          throw APIError.unauthorized
        case .code402(let response):
          return CallReservation(refusal: voiceRefusal(status: 402, error: try? response.body.json))
        case .forbidden(let response):
          return CallReservation(refusal: voiceRefusal(status: 403, error: try? response.body.json))
        case .conflict(let response):
          return CallReservation(refusal: voiceRefusal(status: 409, error: try? response.body.json))
        case .tooManyRequests(let response):
          return CallReservation(refusal: voiceRefusal(status: 429, error: try? response.body.json))
        case .serviceUnavailable(let response):
          return CallReservation(refusal: voiceRefusal(status: 503, error: try? response.body.json))
        case .unprocessableContent(let response):
          return CallReservation(refusal: voiceRefusal(status: 422, error: try? response.body.json))
        case .badRequest, .notFound, .internalServerError, .undocumented:
          return .failed
        }
      }
    } catch {
      return .failed
    }
  }

  /// Sends the WebRTC offer to the reservation's session URL and returns GPT-Live's answer. Our
  /// server creates the session with its own model, instructions and voice.
  func redeemSdp(
    conversationId: String,
    connectionId: String,
    offer: String,
    token: String
  ) async throws -> String {
    try await clients.perform(token: token) { client in
      let output = try await client.redeemLanguageConversationSdp(
        path: .init(conversationId: conversationId, connectionId: connectionId),
        body: .json(.init(sdp: offer)))

      switch output {
      case .created(let response):
        return try response.body.json.sdp
      case .unauthorized:
        throw APIError.unauthorized
      case .code402, .conflict, .notFound, .unprocessableContent, .badRequest,
        .internalServerError, .serviceUnavailable, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  /// Has the server hang the connection up. `endedAtDeadline` when the server already had at the
  /// call's deadline; nil while it couldn't confirm, so asking again sends a new request.
  func end(conversationId: String, connectionId: String, token: String) async -> Bool? {
    do {
      return try await clients.perform(token: token) { client in
        let output = try await client.endLanguageConversationConnection(
          path: .init(conversationId: conversationId, connectionId: connectionId))

        switch output {
        case .ok(let response):
          return try response.body.json.endReason == .deadline
        case .unauthorized:
          throw APIError.unauthorized
        default:
          return nil
        }
      }
    } catch {
      return nil
    }
  }

  /// Every goal met so far, from what was said; nil when the check didn't run.
  func checkObjectives(
    conversationId: String,
    turns: [ConversationTurn],
    token: String
  ) async -> [String]? {
    try? await clients.perform(token: token) { client in
      let output = try await client.checkLanguageConversationObjectives(
        path: .init(conversationId: conversationId), body: .json(.init(turns: turns)))

      guard case .ok(let response) = output else {
        return nil
      }

      return try response.body.json.objectivesMet
    }
  }

  /// Saves the finished call under the connection it ran on.
  func complete(
    conversationId: String,
    input: Components.Schemas.LanguageConversationCompletionInput,
    token: String
  ) async -> CallCompletion {
    do {
      return try await clients.perform(token: token) { client in
        let output = try await client.completeLanguageConversation(
          path: .init(conversationId: conversationId), body: .json(input))

        switch output {
        case .ok(let response):
          return .completed(try response.body.json)
        case .unauthorized:
          throw APIError.unauthorized
        case .conflict(let response):
          let code = (try? response.body.json)?.error.code

          if code == "CALL_TAKEN_OVER" {
            return .takenOver
          }

          return code == "CONVERSATION_ENDED" ? .ended : .failed
        default:
          return .failed
        }
      }
    } catch {
      return .failed
    }
  }
}
