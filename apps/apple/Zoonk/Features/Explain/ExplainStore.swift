import Foundation
import Observation

typealias Explanation = Components.Schemas.Explanation

@MainActor
@Observable
final class ExplainStore {
  @ObservationIgnored private let clients: APIClientFactory
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var explanations: [String: Resource<Explanation>] = [:]

  init(clients: APIClientFactory, cache: AppCache) {
    self.clients = clients
    self.cache = cache
  }

  func explanation(goalID: String) -> Resource<Explanation> {
    if let resource = explanations[goalID] {
      return resource
    }

    let resource: Resource<Explanation> = cache.resource(audience: .signedIn, domains: [.goals]) {
      [clients] session in
      guard let session else {
        return nil
      }

      let output = try await clients.perform(token: session.bearerToken) { client in
        try await client.getExplanation(path: .init(goalId: goalID))
      }

      switch output {
      case .ok(let response):
        return try response.body.json
      case .notFound:
        throw APIError.notFound
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }

    explanations[goalID] = resource
    return resource
  }
}
