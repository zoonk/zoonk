import Foundation
import OpenAPIRuntime
import SwiftUI

enum CodeRunPhase: String, Sendable {
  case starting, compiling, running
}

/// How a run on our servers ended.
enum CodeRunOutcome: Equatable, Sendable {
  case finished(CodeProgramRun)
  case refused(HelpLimit)
  /// No connection reached us, and these languages run only on our servers.
  case offline
  /// The program didn't run this time.
  case unavailable
}

/// Runs a program in a language the device can't run (`CodeLanguage.runsOnDevice`) on our servers.
struct CodeRuns: Sendable {
  struct Request: Sendable {
    let code: String
    let language: CodeLanguage
    /// The same for a run sent again, so the server runs and spends it once.
    let id: String
    let phase: @MainActor @Sendable (CodeRunPhase) -> Void
    /// False once nothing waits for the run, so a run still going stops being asked about.
    let keepWaiting: @MainActor @Sendable () -> Bool
  }

  /// Nil once the session it was sent for has ended.
  let run: @MainActor @Sendable (Request) async -> CodeRunOutcome?

  /// Without our servers, as in previews.
  static let unavailable = CodeRuns { _ in .unavailable }

  /// A run spends the learner's allowance, so it's a write.
  static func live(api: CodeRunAPI, cache: AppCache) -> CodeRuns {
    CodeRuns { request in
      let result = await cache.mutate(invalidating: [.allowance], wrote: \.spent) { session in
        try await api.run(request, token: session.bearerToken)
      }

      switch result {
      case .done(let outcome): return outcome
      case .failed(.network): return .offline
      case .failed: return .unavailable
      case .obsolete: return nil
      }
    }
  }
}

extension EnvironmentValues {
  @Entry var codeRuns: CodeRuns = .unavailable
}

extension CodeRunOutcome {
  /// Only a run that happened counts against the allowance.
  fileprivate var spent: Bool {
    if case .finished = self { true } else { false }
  }
}

struct CodeRunAPI: Sendable {
  private let clients: APIClientFactory
  private let askAgainAfter: Duration

  init(clients: APIClientFactory, askAgainAfter: Duration = .seconds(1)) {
    self.clients = clients
    self.askAgainAfter = askAgainAfter
  }

  /// A learner runs one program at a time, on any device, so "already running" waits and asks
  /// again under the same request: that request's own run answers once it ends, and another
  /// device's run lets this one start once it ends. The server ends a lost run, so the asking ends
  /// too. A connection that fails or closes before the result throws `APIError.network`.
  func run(_ request: CodeRuns.Request, token: String?) async throws -> CodeRunOutcome {
    guard
      let language = Operations.RunCode.Input.Body.JsonPayload.LanguagePayload(
        rawValue: request.language.rawValue)
    else {
      return .unavailable
    }

    let body = Operations.RunCode.Input.Body.JsonPayload(
      code: request.code, language: language, requestId: request.id)

    while true {
      if let outcome = try await send(body, token: token, phase: request.phase) {
        return outcome
      }

      try await Task.sleep(for: askAgainAfter)

      guard await request.keepWaiting() else {
        throw CancellationError()
      }
    }
  }

  /// Nil while the run is still going.
  private func send(
    _ body: Operations.RunCode.Input.Body.JsonPayload, token: String?,
    phase: @MainActor @Sendable (CodeRunPhase) -> Void
  ) async throws -> CodeRunOutcome? {
    do {
      switch try await clients.makeStreamingClient(token: token).runCode(body: .json(body)) {
      case .ok(let response):
        let events = try response.body.textEventStream
          .asDecodedServerSentEventsWithJSONData(of: CodeRunEvent.self)

        for try await event in events {
          switch (event.event, event.data) {
          case ("phase"?, let data?):
            if let step = data.phase.flatMap(CodeRunPhase.init) {
              await phase(step)
            }
          case ("result"?, let data?):
            return data.outcome
          default:
            continue
          }
        }

        throw APIError.network
      case .conflict:
        return nil
      case .code402(let response):
        return Self.refused(status: 402, try? response.body.json)
      case .forbidden(let response):
        return Self.refused(status: 403, try? response.body.json)
      case .tooManyRequests(let response):
        return Self.refused(status: 429, try? response.body.json)
      case .unauthorized:
        throw APIError.unauthorized
      case .badRequest, .internalServerError, .undocumented:
        return .unavailable
      }
    } catch {
      throw apiError(from: error)
    }
  }

  private static func refused(status: Int, _ error: Components.Schemas._Error?) -> CodeRunOutcome {
    voiceRefusal(status: status, error: error).limit.map(CodeRunOutcome.refused) ?? .unavailable
  }
}

/// A `phase` or `result` event's data: core's `CodeRunPhase` or `CodeRunResult`.
private struct CodeRunEvent: Decodable, Hashable, Sendable {
  struct Failure: Decodable, Hashable, Sendable {
    let line: Int?
    let message: String
  }

  let phase: String?
  let runId: String?
  let stop: String?
  let output: String?
  let errorOutput: String?
  let error: Failure?

  var outcome: CodeRunOutcome {
    guard let runId, let stop = stop.flatMap(CodeProgramRun.Stop.init), stop != .unavailable
    else {
      return .unavailable
    }

    return .finished(
      CodeProgramRun(
        stop: stop, output: output ?? "", errorOutput: errorOutput ?? "", error: error?.message,
        errorLine: error?.line, runID: runId))
  }
}
