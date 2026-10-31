import Foundation
import Observation

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
  @ObservationIgnored private var checkpointCalls: [String: Resource<LanguageCheckpointCall>] = [:]
  @ObservationIgnored private var conversations: [String: Resource<LanguageConversation>] = [:]

  init(clients: APIClientFactory, cache: AppCache) {
    let api = VoiceAPI(clients: clients)
    self.api = api
    liveCalls = LiveCallAPI(clients: clients)
    self.cache = cache
    player = SpeechPlayer(
      api: api, session: cache.session, files: VoiceFileCache(apiURL: clients.serverURL))
  }

  /// What was heard changes `domains` only once it's graded.
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

  func conversation(id: String) -> Resource<LanguageConversation> {
    if let conversation = conversations[id] {
      return conversation
    }

    let conversation = cache.resource(audience: .signedIn) {
      [liveCalls] session -> LanguageConversation? in
      guard let session else {
        return nil
      }

      return try await liveCalls.conversation(id: id, token: session.bearerToken)
    }

    conversations[id] = conversation
    return conversation
  }

  func checkpointCall(blockId: String) -> Resource<LanguageCheckpointCall> {
    if let call = checkpointCalls[blockId] {
      return call
    }

    let call = cache.resource(
      audience: .signedIn, domains: [.userProgress, .userSession, .userSubscription]
    ) { [liveCalls] session -> LanguageCheckpointCall? in
      guard let session else {
        return nil
      }

      return try await liveCalls.checkpointCall(blockId: blockId, token: session.bearerToken)
    }

    checkpointCalls[blockId] = call
    return call
  }
}
