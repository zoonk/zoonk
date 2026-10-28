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
  private var patterns: [String: Resource<NoticedPattern>] = [:]

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
      audience: .signedIn, domains: [.learnerModel, .learningProfile]
    ) { session in
      guard let session else { return nil }
      return try await api.mistakes(
        token: session.bearerToken, goalId: goalId, fixed: fixed, cursor: nil)
    }

    mistakeLists[key] = list
    return list
  }

  /// The pattern the notebook offers beside a goal's mistakes; empty for a goal without one.
  func pattern(goalId: String) -> Resource<NoticedPattern> {
    if let pattern = patterns[goalId] {
      return pattern
    }

    let api = api
    let pattern: Resource<NoticedPattern> = cache.resource(
      audience: .signedIn, domains: [.learnerModel, .learningProfile]
    ) { session in
      guard let session else { return nil }
      return try await api.notebookPattern(token: session.bearerToken, goalId: goalId)
    }

    patterns[goalId] = pattern
    return pattern
  }

  /// Revalidates what a practice write made elsewhere changed (the voice lane's challenge call
  /// start), the way `write` does for practice's own writes.
  func changed(_ change: PracticeChange) {
    cache.invalidate(change.domains)
  }

  /// A practice write through the app's shared `AppCache.mutate`: it captures the session, signs
  /// out on a 401, revalidates `change`'s domains, and returns `.obsolete` (never publish, never
  /// navigate, never start the next write) when the learner or the screen is gone. Refusals the
  /// screens name (`PracticeAPIError`: Plus, a conflict's code, a refused move) come back as values.
  func write<Value: Sendable>(
    _ change: PracticeChange, _ operation: @escaping (AuthenticatedSession) async throws -> Value
  ) async -> PracticeWrite<Value> {
    let result = await cache.mutate(invalidating: change.domains) { identity in
      do {
        return Result<Value, PracticeAPIError>.success(try await operation(identity))
      } catch let refusal as PracticeAPIError {
        return .failure(refusal)
      }
    }

    switch result {
    case .done(.success(let value)): return .done(value)
    case .done(.failure(let refusal)): return .refused(refusal)
    case .failed(let error): return .failed(error)
    case .obsolete: return .obsolete
    }
  }

}

/// How a practice write ended.
enum PracticeWrite<Value: Sendable>: Sendable {
  case done(Value)
  case failed(APIError)
  /// The learner or the screen is gone: show nothing, navigate nowhere.
  case obsolete
  case refused(PracticeAPIError)
}

extension PracticeChange {
  /// What core revalidates for each practice write: answers save and fix mistakes (the learner
  /// model) and count toward the day; finishes also move the day and the plan; plan changes
  /// replan the goal.
  var domains: Set<DataDomain> {
    switch self {
    case .answered, .patternDone: [.learnerModel, .userProgress]
    case .finished: [.goals, .learnerModel, .userProgress]
    case .planChanged: [.goals, .learnerModel]
    }
  }
}
