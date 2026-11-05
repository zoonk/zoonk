import Foundation
import Observation

@MainActor
@Observable
final class CertificatesStore {
  /// Newest first. Subscribing issues the locked ones, and a rename draws the pictures again.
  let list: Resource<[OwnedCertificate]>
  /// Only the empty page reads it, as main's does.
  let upNext: Resource<[CertificateUpNext]>

  @ObservationIgnored private let api: any CertificatesAPIClient
  @ObservationIgnored private let cache: AppCache
  /// Moments the learner closed here, so a certificate that a result and its retry both carry
  /// plays once. One left through See Plus isn't, so it plays again after the next task.
  @ObservationIgnored private var closedMoments: Set<String> = []

  init(api: any CertificatesAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    list = cache.resource(
      audience: .signedIn, domains: [.certificates, .userSession, .userSubscription],
      isEmpty: \.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken)
    }
    upNext = cache.resource(
      audience: .signedIn, domains: [.goals, .learningProfile, .userProgress],
      isEmpty: \.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.upNext(token: session.bearerToken)
    }
  }

  /// Nil while the list loads, or until it's read again after the certificate was earned.
  func certificate(code: String) -> OwnedCertificate? {
    list.value?.first { $0.id == code }
  }

  /// The ones whose moment wasn't closed here yet. The learner's list gains them.
  func claimMoments(_ earned: [CertificateFacts]) -> [CertificateFacts] {
    let new = earned.filter { !closedMoments.contains($0.code) }

    if !new.isEmpty {
      cache.invalidate([.certificates])
    }

    return new
  }

  /// Continue closes them for good: they stop coming back with results.
  func closeMoments(_ codes: [String]) {
    closedMoments.formUnion(codes)

    for code in codes {
      Task { await markShown(code) }
    }
  }

  /// `.done([])` while nothing of the goal is finished.
  func claim(goalID: String) async -> MutationResult<[ClaimedCertificate]> {
    await cache.mutate(invalidating: [.certificates, .goals]) { identity in
      try await api.claim(token: identity.bearerToken, goalID: goalID)
    }
  }

  /// A failed mark only means the moment may play again after the learner's next task.
  private func markShown(_ code: String) async {
    _ = await cache.mutate(invalidating: [.certificates]) { identity in
      try await api.markShown(token: identity.bearerToken, code: code)
    }
  }
}
