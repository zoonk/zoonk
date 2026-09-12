import Foundation
import OpenAPIRuntime

protocol LearningProfileAPIClient: Sendable {
  func getInterests(token: String) async throws -> [String]
  func updateInterests(_ interests: [String], token: String) async throws -> [String]
}

enum LearningProfileFailure: Error, Equatable {
  case unauthorized
  case invalid
  case unavailable
}

struct LearningProfileAPI: LearningProfileAPIClient, @unchecked Sendable {
  let clients: APIClientFactory

  static func live() -> LearningProfileAPI {
    LearningProfileAPI(clients: .live(baseURL: AppConfiguration.current.apiBaseURL))
  }

  func getInterests(token: String) async throws -> [String] {
    let output = try await clients.makeClient(token: token).getCurrentUserLearningProfile(.init())
    switch output {
    case .ok(let response): return try response.body.json.interests
    case .unauthorized: throw LearningProfileFailure.unauthorized
    case .internalServerError, .undocumented: throw LearningProfileFailure.unavailable
    }
  }

  func updateInterests(_ interests: [String], token: String) async throws -> [String] {
    let output = try await clients.makeClient(token: token).updateCurrentUserLearningProfile(
      .init(body: .json(.init(interests: interests))))
    switch output {
    case .ok(let response): return try response.body.json.interests
    case .unauthorized: throw LearningProfileFailure.unauthorized
    case .badRequest: throw LearningProfileFailure.invalid
    case .forbidden, .internalServerError, .undocumented: throw LearningProfileFailure.unavailable
    }
  }
}
