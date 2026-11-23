import Foundation
import Observation

@MainActor
@Observable
final class BuddyStore {
  let status: Resource<BuddyStatus>

  /// Waits in the Buddy tab's composer for the learner's own send.
  var broughtQuestion: String?

  @ObservationIgnored private let api: any BuddyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let saves: LearnerSaves
  @ObservationIgnored private var latestSave = 0

  init(api: any BuddyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)

    status = cache.resource(
      audience: .signedIn, domains: [.goals, .learningProfile, .userProgress, .userSession]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.status(
        timeZone: TimeZone.current.identifier, token: session.bearerToken)
    }
  }

  /// Saves even when the screen that asked goes away first. A failed save puts the buddy before
  /// back, and only the latest save can report a failure: false when it did.
  @discardableResult
  func save(_ choice: BuddyChoice) async -> Bool {
    latestSave += 1
    let request = latestSave
    let previous = status.value?.buddy
    status.update { status in
      var status = status
      status.buddy = .init(
        glasses: .init(rawValue: choice.glasses.rawValue) ?? .round,
        kind: .init(rawValue: choice.kind.rawValue) ?? .zu,
        name: choice.name,
        picked: true)
      return status
    }

    let result = await saves.save { [api, cache] in
      let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
        try await api.save(choice, token: identity.bearerToken)
      }

      if request == self.latestSave, case .failed = result, let previous {
        self.status.update { status in
          var status = status
          status.buddy = previous
          return status
        }
      }

      return result
    }

    guard request == latestSave, case .failed = result else {
      return true
    }

    return false
  }

  /// Saves even when the screen that asked goes away first, which then gets `.obsolete`.
  func answer(_ insight: MemoryInsight, accepted: Bool) async -> MutationResult<MemoryInsight?> {
    await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.goals, .learnerModel, .memory, .userSession]) { identity in
        try await api.answer(
          insightId: insight.id, accepted: accepted, quote: insight.planChange?.quote,
          token: identity.bearerToken)
      }
    }
  }
}
