import Foundation
import Observation

/// Every country a picker offers, named in one language. Core keeps the list; the app keeps none.
@MainActor
@Observable
final class CountryCatalogStore {
  @ObservationIgnored private let clients: APIClientFactory
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var catalogs: [String: Resource<[CountryChoice]>] = [:]

  init(clients: APIClientFactory, cache: AppCache) {
    self.clients = clients
    self.cache = cache
  }

  /// `language` is the goal's, so a pick's lesson language is the one its lessons use.
  func countries(language: String) -> Resource<[CountryChoice]> {
    if let catalog = catalogs[language] {
      return catalog
    }

    let catalog = cache.resource(audience: .everyone, maxAge: .seconds(86_400)) {
      [clients] _ in
      try await Self.fetch(language: language, clients: clients)
    }

    catalogs[language] = catalog
    return catalog
  }

  private nonisolated static func fetch(language: String, clients: APIClientFactory) async throws
    -> [CountryChoice]
  {
    try await clients.perform(token: nil) { client in
      switch try await client.listCountries(
        query: .init(language: .init(rawValue: language) ?? .en))
      {
      case .ok(let response): return .init(suggested: try response.body.json.countries)
      default: throw APIError.unavailable
      }
    }
  }
}
