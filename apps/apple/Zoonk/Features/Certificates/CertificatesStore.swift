import Foundation
import Observation

@MainActor
@Observable
final class CertificatesStore {
  /// Newest first.
  let list: Resource<[Certificate]>

  @ObservationIgnored private let api: any CertificatesAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var certificates: [String: Resource<Certificate>] = [:]
  /// Moments already played here, so a certificate that a result and its retry both carry plays
  /// once.
  @ObservationIgnored private var playedMoments: Set<String> = []

  init(api: any CertificatesAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    list = cache.resource(
      audience: .signedIn, domains: [.certificates, .userSession], isEmpty: \.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken)
    }
  }

  /// Public, so it's kept across sessions; only the learner's name changes it.
  func certificate(code: String) -> Resource<Certificate> {
    if let resource = certificates[code] {
      return resource
    }

    let api = api
    let resource: Resource<Certificate> = cache.resource(
      audience: .everyone, domains: [.userSession]
    ) { _ in
      try await api.certificate(code: code)
    }

    certificates[code] = resource
    return resource
  }

  /// The ones whose moment hasn't played here yet. The learner's list gains them.
  func claimMoments(_ earned: [CertificateFacts]) -> [CertificateFacts] {
    let new = earned.filter { playedMoments.insert($0.code).inserted }

    if !new.isEmpty {
      cache.invalidate([.certificates])
    }

    return new
  }

  /// A failed mark only means the moment may play again after the learner's next task.
  func markShown(_ code: String) async {
    _ = await cache.mutate(invalidating: [.certificates]) { identity in
      try await api.markShown(token: identity.bearerToken, code: code)
    }
  }

  /// `.done(nil)` while the course isn't finished.
  func claim(goalID: String) async -> MutationResult<ClaimedCertificate?> {
    await cache.mutate(invalidating: [.certificates, .goals]) { identity in
      try await api.claim(token: identity.bearerToken, goalID: goalID)
    }
  }
}
