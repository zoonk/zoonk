import Foundation
import Observation

typealias WarmUpDeck = Components.Schemas.WarmUpDeck
typealias WarmUpCard = Components.Schemas.WarmUpDeck.CardsPayloadPayload

protocol WarmUpAPIClient: Sendable {
  /// Nil when the deck is missing or not ready.
  func deck(id: String, token: String) async throws -> WarmUpDeck?
}

struct WarmUpAPI: WarmUpAPIClient {
  let clients: APIClientFactory

  func deck(id: String, token: String) async throws -> WarmUpDeck? {
    let output = try await clients.perform(token: token) {
      try await $0.getWarmUp(path: .init(warmUpId: id))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .notFound, .badRequest:
      return nil
    case .unauthorized:
      throw APIError.unauthorized
    case .internalServerError, .undocumented:
      throw APIError.network
    }
  }
}

/// A goal's decks of guesses for its waits, and the first card the learner hasn't guessed in each
/// for this app session, so every later wait (placement, the time question, the first lesson) goes
/// on from there.
@MainActor
@Observable
final class WarmUpStore {
  /// A deck that's ready never changes.
  private static let deckMaxAge = Duration.seconds(24 * 60 * 60)

  private var unguessed: [String: Int] = [:]
  /// Whose guesses `unguessed` counts: another learner starts each deck over.
  private var owner: AuthenticatedSession?

  @ObservationIgnored private let api: any WarmUpAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var decks: [String: Resource<WarmUpDeck>] = [:]

  init(api: any WarmUpAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func deck(id: String) -> Resource<WarmUpDeck> {
    if let deck = decks[id] {
      return deck
    }

    let deck: Resource<WarmUpDeck> = cache.resource(
      audience: .signedIn, maxAge: Self.deckMaxAge, isEmpty: \.cards.isEmpty
    ) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.deck(id: id, token: session.bearerToken)
    }
    decks[id] = deck
    return deck
  }

  func firstUnguessed(deckID: String) -> Int {
    owner == cache.session.authenticatedSession ? unguessed[deckID] ?? 0 : 0
  }

  /// Two windows can deal from one deck, so a guess never sends it back.
  func guessed(card: Int, deckID: String) {
    let current = cache.session.authenticatedSession

    if owner != current {
      unguessed = [:]
      owner = current
    }

    unguessed[deckID] = max(unguessed[deckID] ?? 0, card + 1)
  }
}
