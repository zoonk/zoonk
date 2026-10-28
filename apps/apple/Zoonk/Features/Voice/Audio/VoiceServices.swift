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

  /// Grades a recording for the current learner through `AppCache.mutate`; what was heard
  /// changes `domains` only once it's graded.
  func grade<Value: Sendable>(
    invalidating domains: Set<DataDomain> = [],
    _ request: (String) async throws -> Refusable<Value>
  ) async -> GradeOutcome<Value> {
    switch await cache.mutate({ try await request($0.bearerToken) }) {
    case .done(.done(let value)):
      cache.invalidate(domains)
      return .graded(value)
    case .done(.refused(let refusal)):
      if refusal.isNoSpeech {
        return .noSpeech
      }

      return refusal.limit.map(GradeOutcome.limit) ?? .failed
    case .failed:
      return .failed
    case .obsolete:
      return .obsolete
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
