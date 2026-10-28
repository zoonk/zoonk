import Foundation
import Observation

/// The practice screens' data: their API on the app's shared client, the notebook's lists as
/// cached resources, and what each practice write changed, for the cache to revalidate.
@MainActor
@Observable
final class PracticeStore {
  let api: PracticeAPI
  private let cache: AppCache
  private var mistakeLists: [String: Resource<Components.Schemas.MistakeList>] = [:]

  init(api: PracticeAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  /// A goal's notebook list, "To fix" or "Fixed", created on first use and kept for the app's life.
  func mistakes(goalId: String?, fixed: Bool) -> Resource<Components.Schemas.MistakeList> {
    let key = "\(goalId ?? "-"):\(fixed)"

    if let list = mistakeLists[key] {
      return list
    }

    let api = api
    let list: Resource<Components.Schemas.MistakeList> = cache.resource(
      audience: .signedIn, domains: [.learnerModel]
    ) { session in
      guard let session else { return nil }
      return try await api.mistakes(
        token: session.bearerToken, goalId: goalId, fixed: fixed, cursor: nil)
    }

    mistakeLists[key] = list
    return list
  }

  /// Revalidates what a practice write changed, the way core revalidates main's cache tags:
  /// answers save and fix mistakes (the learner model) and count toward the day's progress;
  /// finishes also move the day and the plan; plan changes replan the goal.
  func changed(_ change: PracticeChange) {
    switch change {
    case .answered: cache.invalidate([.learnerModel, .userProgress])
    case .finished: cache.invalidate([.goals, .learnerModel, .userProgress])
    case .planChanged: cache.invalidate([.goals, .learnerModel])
    }
  }
}
