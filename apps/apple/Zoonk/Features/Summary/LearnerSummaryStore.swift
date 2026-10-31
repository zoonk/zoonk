import Foundation
import Observation

@MainActor
@Observable
final class LearnerSummaryStore {
  let summary: Resource<LearnerSummary>

  private let api: any LearnerSummaryAPIClient
  private let cache: AppCache

  init(api: any LearnerSummaryAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    summary = cache.resource(
      audience: .signedIn,
      domains: [
        .allowance, .goals, .learnerModel, .learningProfile, .memory, .userProgress, .userSession,
        .userSubscription,
      ],
      maxAge: .seconds(60)
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.getSummary(token: session.bearerToken)
    }
  }

  /// Run in a task keyed by `nextChangeAt`, so a newer summary reschedules it.
  func refreshAtNextChange() async {
    guard let nextChangeAt = summary.value?.nextChangeAt else {
      return
    }

    do {
      try await Task.sleep(for: .seconds(max(0, nextChangeAt.timeIntervalSinceNow)))
    } catch {
      return
    }

    await summary.refresh()
  }

  /// True once the goal is the one the tabs show, with the summary read again for it.
  @discardableResult
  func switchGoal(to goalID: String) async -> Bool {
    guard summary.value?.activeGoalID != goalID else {
      return true
    }

    let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
      try await api.switchGoal(token: identity.bearerToken, goalID: goalID)
    }

    guard case .done = result else {
      return false
    }

    await summary.refresh()
    return true
  }
}
