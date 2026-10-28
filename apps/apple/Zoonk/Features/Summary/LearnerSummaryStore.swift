import Foundation
import Observation

/// The learner summary every part of the frame reads (tabs, goal switcher, level, account), kept
/// fresh for the app's lifetime: read on launch and sign-in, on returning to the foreground after
/// a minute, at its `nextChangeAt`, and after any mutation, since every write can change it.
@MainActor
@Observable
final class LearnerSummaryStore {
  let summary: Resource<LearnerSummary>

  init(api: any LearnerSummaryAPIClient, cache: AppCache) {
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

  /// Reads the summary again when it says it changes. The composition root runs this in a task
  /// keyed by `nextChangeAt`, so a newer summary reschedules it.
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
}
