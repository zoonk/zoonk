import Foundation
import Observation

@MainActor
@Observable
final class ExamStore {
  @ObservationIgnored let api: ExamAPI
  @ObservationIgnored let cache: AppCache
  @ObservationIgnored private var exams: [String: Resource<ExamView>] = [:]
  @ObservationIgnored private var options: [String: Resource<MockOptions>] = [:]
  @ObservationIgnored private var essays: [String: Resource<EssayView>] = [:]
  @ObservationIgnored private let saves: LearnerSaves

  init(api: ExamAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)
  }

  func exam(goalId: String) -> Resource<ExamView> {
    if let exam = exams[goalId] {
      return exam
    }

    let api = api
    let exam: Resource<ExamView> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .learningProfile, .userSubscription]
    ) { session in
      guard let session else { return nil }
      return try await api.exam(token: session.bearerToken, goalId: goalId)
    }

    exams[goalId] = exam
    return exam
  }

  func mockOptions(goalId: String) -> Resource<MockOptions> {
    if let list = options[goalId] {
      return list
    }

    let api = api
    let list: Resource<MockOptions> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .learningProfile, .userSubscription]
    ) { session in
      guard let session else { return nil }
      return try await api.mockOptions(token: session.bearerToken, goalId: goalId)
    }

    options[goalId] = list
    return list
  }

  /// Each opening reads the mock again, as main's page does, so a runner never starts from a read
  /// older than its saves.
  func mock(blockId: String) -> Resource<MockView> {
    let api = api
    return cache.resource(audience: .signedIn) { session in
      guard let session else { return nil }
      return try await api.mock(token: session.bearerToken, blockId: blockId)
    }
  }

  func essay(blockId: String) -> Resource<EssayView> {
    if let essay = essays[blockId] {
      return essay
    }

    let api = api
    let essay: Resource<EssayView> = cache.resource(audience: .signedIn) { session in
      guard let session else { return nil }
      return try await api.essay(token: session.bearerToken, blockId: blockId)
    }

    essays[blockId] = essay
    return essay
  }

  func write<Value: Sendable>(
    invalidating domains: Set<DataDomain> = [],
    _ operation: @escaping (ExamAPI, String) async throws -> Value
  ) async -> MutationResult<Value> {
    await cache.mutate(invalidating: domains) { [api] identity in
      try await operation(api, identity.bearerToken)
    }
  }

  /// The official result the learner reports: saved even when the page that asked goes away first,
  /// which then gets `.obsolete`.
  func reportResult(goalId: String, _ input: ExamResultInput) async -> MutationResult<Bool> {
    await saves.save {
      await self.write(invalidating: [.learnerModel]) { api, token in
        try await api.reportResult(token: token, goalId: goalId, input: input)
      }
    }
  }

  /// Only from a learner's tap.
  func startMock(goalId: String, shape: MockShape) async -> MutationResult<MockStartOutcome> {
    await write(invalidating: [.learnerModel]) { api, token in
      try await api.startMock(token: token, goalId: goalId, shape: shape)
    }
  }
}
