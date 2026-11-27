import Foundation
import Observation

@MainActor
@Observable
final class PracticeStore {
  let api: PracticeAPI
  private let cache: AppCache
  private var mistakeLists: [String: Resource<Components.Schemas.MistakeList>] = [:]
  private var patterns: [String: Resource<NoticedPattern>] = [:]
  @ObservationIgnored private let saves: LearnerSaves

  init(api: PracticeAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)
  }

  struct ScheduledChange: Equatable {
    let owner: AuthenticatedSession
    let itemId: String
    let changeId: String
    let date: String?
  }

  private var scheduledChange: ScheduledChange?
  var mockScheduleNotice: ScheduledChange? {
    guard let change = scheduledChange, change.owner == cache.session.authenticatedSession else {
      return nil
    }
    return change
  }

  func changeMockSchedule(itemId: String, date: String?) async -> Bool? {
    switch await write(
      .planChanged, onPurpose: true,
      { [api] session in
        let change = try await api.changeMockSchedule(
          token: session.bearerToken, itemId: itemId, date: date)
        return ScheduledChange(owner: session, itemId: itemId, changeId: change, date: date)
      })
    {
    case .done(let change):
      scheduledChange = change
      return true
    case .failed, .refused: return false
    case .obsolete: return nil
    }
  }

  func dismissMockScheduleNotice(_ change: ScheduledChange) {
    if scheduledChange == change { scheduledChange = nil }
  }

  func undoMockSchedule(_ change: ScheduledChange) async -> Bool? {
    guard mockScheduleNotice == change else { return nil }
    switch await write(
      .planChanged, onPurpose: true,
      { [api] session in
        try await api.undoMockSchedule(
          token: session.bearerToken, itemId: change.itemId, changeId: change.changeId)
      })
    {
    case .done:
      dismissMockScheduleNotice(change)
      return true
    case .failed, .refused: return false
    case .obsolete: return nil
    }
  }

  func mockScheduleDates(itemId: String) -> Resource<[String]> {
    cache.resource(audience: .signedIn, domains: [.goals]) { [api] session in
      guard let session else { return nil }
      return try await api.mockScheduleDates(token: session.bearerToken, itemId: itemId)
    }
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

  func openLesson(mistakeId: String) async -> MutationResult<String> {
    await cache.mutate(invalidating: [.learnerModel]) { [api] session in
      try await api.openMistakeLesson(token: session.bearerToken, mistakeId: mistakeId)
    }
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
  /// screen is gone. Refusals the screens name (`PracticeAPIError`) come back as values. A write
  /// the learner made on purpose (`onPurpose`), such as stopping, saves even when its screen goes
  /// away first (`LearnerSaves`).
  func write<Value: Sendable>(
    _ change: PracticeChange, onPurpose: Bool = false,
    _ operation: @escaping (AuthenticatedSession) async throws -> Value
  ) async -> PracticeWrite<Value> {
    let save: @MainActor () async -> MutationResult<Result<Value, PracticeAPIError>> = {
      await self.cache.mutate(invalidating: change.domains) { identity in
        do {
          return Result<Value, PracticeAPIError>.success(try await operation(identity))
        } catch let refusal as PracticeAPIError {
          return .failure(refusal)
        }
      }
    }
    let result = onPurpose ? await saves.save(save) : await save()

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
  /// Mirrors what core revalidates for each practice write, and the day a pattern's practice
  /// completes a block of.
  var domains: Set<DataDomain> {
    switch self {
    case .answered: [.learnerModel, .userProgress, .userSession]
    case .patternDone: [.learnerModel, .userProgress, .userSession]
    case .finished: [.goals, .learnerModel, .userProgress, .userSession]
    case .planChanged: [.goals, .learnerModel, .userSession]
    }
  }
}
