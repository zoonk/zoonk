import Foundation
import Observation

/// The buddy's day (Energy, missions, stage, glasses) and the learner's earlier questions, kept
/// for the app's lifetime. Picking a buddy shows at once and saves in the background.
@MainActor
@Observable
final class BuddyStore {
  let status: Resource<BuddyStatus>
  let earlierQuestions: Resource<EarlierQuestionsPage>

  /// A question brought from search ("Ask the buddy about it"): the Buddy tab puts it in its
  /// composer, where it waits for the learner's own send.
  var broughtQuestion: String?
  /// The latest buddy picked didn't save, so the buddy kept the one before.
  private(set) var saveFailed = false
  private(set) var isLoadingOlder = false
  private(set) var olderFailed = false

  @ObservationIgnored private let api: any BuddyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var latestSave = 0

  init(api: any BuddyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache

    // Missions follow the day's session, Energy and the stage follow progress, and the buddy
    // itself the learning profile.
    status = cache.resource(
      audience: .signedIn, domains: [.goals, .learningProfile, .userProgress, .userSession]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.status(
        timeZone: TimeZone.current.identifier, token: session.bearerToken)
    }

    // Earlier questions are history: they never change.
    earlierQuestions = cache.resource(
      audience: .signedIn,
      maxAge: .seconds(60 * 60 * 24),
      isEmpty: { $0.questions.isEmpty },
      fetch: { session in
        guard let session else {
          return nil
        }

        return try await api.earlierQuestions(cursor: nil, token: session.bearerToken)
      })
  }

  /// Picks a buddy, its name or its glasses. The buddy changes at once; a failed save puts the
  /// one before back, and only the latest save can report a failure. A save whose session ended
  /// changes nothing on screen: another learner's buddy may be there now.
  func save(_ choice: BuddyChoice) async {
    latestSave += 1
    let request = latestSave
    let previous = status.value?.buddy
    saveFailed = false
    status.update { status in
      var status = status
      status.buddy = .init(
        glasses: .init(rawValue: choice.glasses.rawValue) ?? .round,
        kind: .init(rawValue: choice.kind.rawValue) ?? .zu,
        name: choice.name,
        picked: true)
      return status
    }

    let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
      try await api.save(choice, token: identity.bearerToken)
    }

    guard request == latestSave, case .failed = result else {
      return
    }

    saveFailed = true

    if let previous {
      status.update { status in
        var status = status
        status.buddy = previous
        return status
      }
    }
  }

  func loadOlderQuestions() async {
    guard let page = earlierQuestions.value, let cursor = page.nextCursor, !isLoadingOlder,
      let session = cache.session.authenticatedSession
    else {
      return
    }

    let revision = earlierQuestions.revision
    isLoadingOlder = true
    olderFailed = false
    defer { isLoadingOlder = false }

    do {
      let older = try await api.earlierQuestions(cursor: cursor, token: session.bearerToken)

      guard earlierQuestions.revision == revision else {
        return
      }

      earlierQuestions.update { page in
        EarlierQuestionsPage(
          questions: page.questions + older.questions, nextCursor: older.nextCursor)
      }
    } catch {
      olderFailed = !(error is CancellationError)
    }
  }

  /// Answers an insight from recent sessions. Accepting a plan change or a schedule idea changes
  /// the plan, so Today and the plan read it again.
  func answer(_ insight: MemoryInsight, accepted: Bool) async -> MutationResult<Void> {
    await cache.mutate(invalidating: [.goals, .learnerModel, .memory, .userSession]) { identity in
      try await api.answer(insightId: insight.id, accepted: accepted, token: identity.bearerToken)
    }
  }
}
