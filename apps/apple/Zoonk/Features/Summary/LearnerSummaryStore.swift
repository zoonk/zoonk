import Foundation
import Observation

@MainActor
@Observable
final class LearnerSummaryStore {
  let summary: Resource<LearnerSummary>

  private let api: any LearnerSummaryAPIClient
  private let cache: AppCache
  /// The learner's changes save, and change the summary, even when the screen that asked goes away.
  private let saves: LearnerSaves

  init(api: any LearnerSummaryAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)
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

  /// Done once the goal is the one the tabs show, with the summary read again for it. Callers run one
  /// switch at a time, so an older switch never answers for a newer pick.
  func switchGoal(to goalID: String) async -> MutationResult<Void> {
    guard summary.value?.activeGoalID != goalID else {
      return .done(())
    }

    return await saves.save { [api, cache] in
      let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
        try await api.switchGoal(token: identity.bearerToken, goalID: goalID)
      }

      if case .done = result {
        await self.summary.refresh()
      }

      return result
    }
  }

  /// False when it didn't save, such as a country the goal's language doesn't offer.
  func setTargetRegion(_ region: String?, goalID: String) async -> Bool {
    let result = await saves.save { [api, cache] in
      let result = await cache.mutate { identity in
        try await api.setTargetRegion(token: identity.bearerToken, goalID: goalID, region: region)
      }

      switch result {
      case .done(true):
        // Shown before the goals are read again, so a read that fails can't bring back the old one.
        self.summary.update { summary in
          var summary = summary

          if let index = summary.goals.firstIndex(where: { $0.id == goalID }) {
            summary.goals[index].variety?.region = region
          }

          return summary
        }

        cache.invalidate([.goals])
      case .failed:
        // One that timed out may have landed.
        cache.invalidate([.goals])
      case .done(false), .obsolete:
        break
      }

      return result
    }

    switch result {
    case .done(let saved):
      return saved
    case .failed:
      return false
    case .obsolete:
      // Another learner's data may be on screen, or the screen that asked is gone: nothing is left
      // to say.
      return true
    }
  }
  /// False when it didn't save. A goal whose content changes by country starts rebuilding its plan,
  /// which its row says until the new plan is ready.
  func setContentCountry(_ country: String?, goalID: String) async -> Bool {
    let result = await saves.save { [api, cache] in
      let result = await cache.mutate { identity in
        try await api.setContentCountry(
          token: identity.bearerToken, goalID: goalID, country: country)
      }

      switch result {
      case .done(.saved(let row)):
        // Shown before the goals are read again, so a read that fails can't bring back the old one.
        self.changeGoal(goalID) { $0.contentCountry = row }
        cache.invalidate([.goals])
      case .failed:
        // One that timed out may have landed.
        cache.invalidate([.goals])
      case .done(.notOffered), .obsolete:
        break
      }

      return result
    }

    switch result {
    case .done(.saved), .obsolete:
      return true
    case .done(.notOffered), .failed:
      return false
    }
  }

  /// False when it didn't start.
  func retryRebuild(goalID: String) async -> Bool {
    let result = await saves.save { [api, cache] in
      let result = await cache.mutate(invalidating: [.goals]) { identity in
        try await api.retryRebuild(token: identity.bearerToken, goalID: goalID)
      }

      if case .done = result {
        self.changeGoal(goalID) { $0.contentCountry?.rebuild = .preparing }
      }

      return result
    }

    switch result {
    case .done, .obsolete:
      return true
    case .failed:
      return false
    }
  }

  /// Run while a screen shows the goal: reads the summary again while its new plan is prepared, then
  /// has the plan read again once it's ready, so the plan changes in place.
  func followRebuild(goalID: String) async {
    var waited = false

    while summary.value?.goals.first(where: { $0.id == goalID })?.contentCountry?.rebuild
      == .preparing
    {
      do {
        try await Task.sleep(for: .seconds(10))
      } catch {
        return
      }

      waited = true
      await summary.refresh()
    }

    if waited {
      cache.invalidate([.goals])
    }
  }

  /// The learner's pick shows at once, wherever the summary is read, such as an applied buddy card.
  func showHomeCountry(_ country: String?) {
    summary.update { summary in
      var summary = summary
      summary.homeCountry = country
      return summary
    }
  }

  private func changeGoal(_ goalID: String, _ change: (inout LearnerGoal) -> Void) {
    summary.update { summary in
      var summary = summary

      if let index = summary.goals.firstIndex(where: { $0.id == goalID }) {
        change(&summary.goals[index])
      }

      return summary
    }
  }
}
