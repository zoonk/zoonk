import Foundation
import Observation

/// The voice feature's app-wide parts, created once in the composition root and read from the
/// environment: the requests, the one player every screen's sounds go through, and the cache that
/// learns what a recording or a call changed.
@MainActor
@Observable
final class VoiceServices {
  @ObservationIgnored let api: VoiceAPI
  @ObservationIgnored let liveCalls: LiveCallAPI
  @ObservationIgnored let cache: AppCache
  let player: SpeechPlayer
  @ObservationIgnored private var speakingPapers:
    [String: Resource<Components.Schemas.SpeakingPaper>] =
      [:]

  init(clients: APIClientFactory, cache: AppCache) {
    let api = VoiceAPI(clients: clients)
    self.api = api
    liveCalls = LiveCallAPI(clients: clients)
    self.cache = cache
    player = SpeechPlayer(
      api: api, session: cache.session, files: VoiceFileCache(apiURL: clients.serverURL))
  }

  /// Runs a learner's request under the session that started it. A result that arrives after
  /// that session ended is dropped (`CancellationError`), and an expired session signs out.
  func perform<Value: Sendable>(
    _ request: @Sendable (String) async throws -> Value
  ) async throws -> Value {
    let session = cache.session

    guard let owner = session.authenticatedSession else {
      throw APIError.unauthorized
    }

    do {
      let value = try await request(owner.bearerToken)

      guard session.authenticatedSession == owner else {
        throw CancellationError()
      }

      return value
    } catch APIError.unauthorized {
      await session.expire(owner)
      throw APIError.unauthorized
    }
  }

  /// A language goal's speaking paper, kept for the app's lifetime. A finished exam task's call
  /// changes its last tries.
  func speakingPaper(goalId: String) -> Resource<Components.Schemas.SpeakingPaper> {
    if let paper = speakingPapers[goalId] {
      return paper
    }

    let paper = cache.resource(audience: .signedIn, domains: [.userProgress]) {
      [api] session -> Components.Schemas.SpeakingPaper? in
      guard let session else {
        return nil
      }

      return try await api.speakingPaper(goalId: goalId, token: session.bearerToken)
    }

    speakingPapers[goalId] = paper
    return paper
  }
}
