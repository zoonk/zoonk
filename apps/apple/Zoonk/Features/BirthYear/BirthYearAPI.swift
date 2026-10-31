import Foundation
import OpenAPIRuntime

enum BirthYearAnswer: Equatable, Sendable {
  case accepted
  case invalidYear
  /// Below the minimum age where the learner is: nothing was saved.
  case belowMinimumAge(Int)
  /// Certainly below it: the server deleted the account, its sessions included, and refunded its
  /// website Plus in full.
  case accountClosed(minimumAge: Int)
}

protocol BirthYearAPIClient: Sendable {
  /// Without a session: a visitor's year, before a guest exists.
  func check(_ birthYear: Int) async throws -> BirthYearAnswer
  func save(_ birthYear: Int, token: String) async throws -> BirthYearAnswer
}

struct BirthYearAPI: BirthYearAPIClient {
  let clients: APIClientFactory

  func check(_ birthYear: Int) async throws -> BirthYearAnswer {
    try await clients.perform(token: nil) { client in
      switch try await client.checkBirthYear(body: .json(.init(birthYear: birthYear))) {
      case .noContent:
        return .accepted
      case .unprocessableContent(let response):
        return try birthYearAnswer(refusedWith: try? response.body.json.error)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func save(_ birthYear: Int, token: String) async throws -> BirthYearAnswer {
    try await clients.perform(token: token) { client in
      switch try await client.saveCurrentUserBirthYear(body: .json(.init(birthYear: birthYear))) {
      case .ok:
        return .accepted
      case .unauthorized:
        throw APIError.unauthorized
      case .unprocessableContent(let response):
        return try birthYearAnswer(refusedWith: try? response.body.json.error)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

private func birthYearAnswer(refusedWith error: Components.Schemas._Error._ErrorPayload?) throws
  -> BirthYearAnswer
{
  switch error?.code {
  case "INVALID_BIRTH_YEAR":
    return .invalidYear
  case "BELOW_MINIMUM_AGE":
    let details = error?.details?.value as? [String: (any Sendable)?]

    guard let minimumAge = (details?["minimumAge"] ?? nil) as? Int else {
      throw APIError.unavailable
    }

    return (details?["accountClosed"] ?? nil) as? Bool == true
      ? .accountClosed(minimumAge: minimumAge) : .belowMinimumAge(minimumAge)
  default:
    throw APIError.unavailable
  }
}
