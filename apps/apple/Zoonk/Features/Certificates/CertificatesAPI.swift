import Foundation

protocol CertificatesAPIClient: Sendable {
  func list(token: String) async throws -> [OwnedCertificate]
  func markShown(token: String, code: String) async throws
  /// Every certificate of the goal's levels and plan, the plan's last; empty while none is finished.
  func claim(token: String, goalID: String) async throws -> [ClaimedCertificate]
  func upNext(token: String) async throws -> [CertificateUpNext]
}

struct ClaimedCertificate: Equatable, Sendable {
  let facts: CertificateFacts
  /// Its moment was closed before, on this device or another.
  let wasShown: Bool
}

struct CertificatesAPI: CertificatesAPIClient {
  let clients: APIClientFactory

  func list(token: String) async throws -> [OwnedCertificate] {
    try await clients.perform(token: token) { client in
      switch try await client.listCertificates() {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json.certificates)
      case .unauthorized: throw APIError.unauthorized
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

  func claim(token: String, goalID: String) async throws -> [ClaimedCertificate] {
    try await clients.perform(token: token) { client in
      switch try await client.claimCourseCertificate(path: .init(goalId: goalID)) {
      case .ok(let response):
        return try response.body.json.certificates.map { certificate in
          ClaimedCertificate(
            facts: try StudyJSON.recode(certificate), wasShown: certificate.shownAt != nil)
        }
      case .conflict: return []
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func upNext(token: String) async throws -> [CertificateUpNext] {
    try await clients.perform(token: token) { client in
      switch try await client.listCertificateProgress() {
      case .ok(let response):
        return try StudyJSON.recode(try response.body.json.upNext)
      case .unauthorized: throw APIError.unauthorized
      default: throw APIError.unavailable
      }
    }
  }
}
