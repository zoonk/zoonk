import Foundation

protocol CertificatesAPIClient: Sendable {
  func list(token: String) async throws -> [Certificate]
  /// Public: anyone with the code reads the same certificate.
  func certificate(code: String) async throws -> Certificate
  func markShown(token: String, code: String) async throws
  /// Nil while the goal's course isn't finished.
  func claim(token: String, goalID: String) async throws -> ClaimedCertificate?
}

struct ClaimedCertificate: Equatable, Sendable {
  let facts: CertificateFacts
  /// Its moment was closed before, on this device or another.
  let wasShown: Bool
}

struct CertificatesAPI: CertificatesAPIClient {
  let clients: APIClientFactory

  func list(token: String) async throws -> [Certificate] {
    try await clients.perform(token: token) { client in
      switch try await client.listCertificates() {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json.certificates)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }

  func certificate(code: String) async throws -> Certificate {
    try await clients.perform(token: nil) { client in
      switch try await client.getCertificate(path: .init(code: code)) {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json)
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func markShown(token: String, code: String) async throws {
    try await clients.perform(token: token) { client in
      switch try await client.markCertificateShown(path: .init(code: code)) {
      case .noContent: return
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func claim(token: String, goalID: String) async throws -> ClaimedCertificate? {
    try await clients.perform(token: token) { client in
      switch try await client.claimCourseCertificate(path: .init(goalId: goalID)) {
      case .ok(let response):
        let certificate = try response.body.json

        return ClaimedCertificate(
          facts: try StudyJSON.recode(certificate), wasShown: certificate.shownAt != nil)
      case .conflict: return nil
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}
