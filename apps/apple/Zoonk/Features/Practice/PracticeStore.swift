import Foundation
import Observation

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

  /// For a practice write made elsewhere, such as a challenge call's start.
  func changed(_ change: PracticeChange) {
    cache.invalidate(change.domains)
  }

  /// Returns `.obsolete` (never publish, navigate or start the next write) when the learner or the
  /// screen is gone. Refusals the screens name (`PracticeAPIError`) come back as values.
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

enum PracticeWrite<Value: Sendable>: Sendable {
  case done(Value)
  case failed(APIError)
  /// Show nothing, navigate nowhere.
  case obsolete
  case refused(PracticeAPIError)
}

extension PracticeChange {
  /// Mirrors what core revalidates for each practice write.
  var domains: Set<DataDomain> {
    switch self {
    case .answered, .patternDone: [.learnerModel, .userProgress]
    case .finished: [.goals, .learnerModel, .userProgress]
    case .planChanged: [.goals, .learnerModel]
    }
  }
}
