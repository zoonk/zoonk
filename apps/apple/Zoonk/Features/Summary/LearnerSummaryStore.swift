import Foundation
import Observation

@MainActor
@Observable
final class LearnerSummaryStore {
  let summary: Resource<LearnerSummary>

  private let api: any LearnerSummaryAPIClient
  private let cache: AppCache
  private var switchesStarted = 0

  init(api: any LearnerSummaryAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    summary = cache.resource(
      audience: .signedIn,
      // Every `DataDomain`, so the frame follows every write.
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

  /// The learner's switch shows at once, so analytics stop before the save is read back.
  func showUsageDataSharing(_ shares: Bool) {
    summary.update { summary in
      var summary = summary
      summary.analytics.usageDataSharing = shares
      return summary
    }
  }

  /// Done once the goal is the one the tabs show, with the summary read again for it. A switch the
  /// learner replaced with a newer one meanwhile comes back `.obsolete`, so only their last choice
  /// moves the screen or says it failed.
  func switchGoal(to goalID: String) async -> MutationResult<Void> {
    switchesStarted += 1
    let attempt = switchesStarted

    let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
      try await api.switchGoal(token: identity.bearerToken, goalID: goalID)
    }

    guard attempt == switchesStarted else {
      return .obsolete
    }

    if case .done = result {
      await summary.refresh()
    }

    return attempt == switchesStarted ? result : .obsolete
  }
}
