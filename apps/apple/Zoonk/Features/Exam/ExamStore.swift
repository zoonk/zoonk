import Foundation
import Observation

@MainActor
@Observable
final class ExamStore {
  @ObservationIgnored let api: ExamAPI
  @ObservationIgnored let cache: AppCache
  @ObservationIgnored private var exams: [String: Resource<ExamView>] = [:]
  @ObservationIgnored private var options: [String: Resource<MockOptions>] = [:]
  @ObservationIgnored private var mocks: [String: Resource<MockView>] = [:]
  @ObservationIgnored private var essays: [String: Resource<EssayView>] = [:]

  init(api: ExamAPI, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func exam(goalId: String) -> Resource<ExamView> {
    if let exam = exams[goalId] {
      return exam
    }

    let api = api
    let exam: Resource<ExamView> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .learningProfile]
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

  /// It changes only by the learner's steps in it, which read it again themselves, so no other
  /// write revalidates it.
  func mock(blockId: String) -> Resource<MockView> {
    if let mock = mocks[blockId] {
      return mock
    }

    let api = api
    let mock: Resource<MockView> = cache.resource(audience: .signedIn) { session in
      guard let session else { return nil }
      return try await api.mock(token: session.bearerToken, blockId: blockId)
    }

    mocks[blockId] = mock
    return mock
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

  /// Only from a learner's tap. A mock that can ask only part of its questions comes back `short`
  /// for the learner to start it knowingly (`acceptFewer`).
  func startMock(
    goalId: String, choice: MockChoice, acceptFewer: Bool,
    onWriting: @escaping @MainActor () -> Void
  ) async -> MutationResult<MockStartOutcome> {
    await write(invalidating: [.learnerModel]) { api, token in
      let first = try await api.startMock(
        token: token, goalId: goalId, choice: choice, acceptFewer: acceptFewer)

      guard first == .needsQuestions else {
        return first
      }

      // While the goal's skill map is still drawn (a goal in onboarding), ask again a while.
      var writing = try await api.requestMockQuestions(token: token, goalId: goalId, choice: choice)

      for _ in 0..<60 where writing == .preparing {
        try await Task.sleep(for: .seconds(3))
        writing = try await api.requestMockQuestions(token: token, goalId: goalId, choice: choice)
      }

      switch writing {
      case .writing(let generationId):
        await onWriting()
        try await api.waitForQuestions(token: token, generationId: generationId)
      case .refused(let limit):
        return .refused(limit)
      case .ready, .preparing:
        break
      }

      return try await api.startMock(
        token: token, goalId: goalId, choice: choice, acceptFewer: true)
    }
  }
}
