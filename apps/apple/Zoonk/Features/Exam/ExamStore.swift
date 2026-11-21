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
  @ObservationIgnored private var attempts: [String: Resource<WritingAttempt>] = [:]
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

  /// A past answer from the written part's page, read as its result was.
  func writingAttempt(id: String) -> Resource<WritingAttempt> {
    if let attempt = attempts[id] {
      return attempt
    }

    let api = api
    let attempt: Resource<WritingAttempt> = cache.resource(audience: .signedIn) { session in
      guard let session else { return nil }
      return try await api.writingAttempt(token: session.bearerToken, attemptId: id)
    }

    attempts[id] = attempt
    return attempt
  }

  /// Only from a learner's tap: it admits the grading, or starts writing the question.
  func startWriting(blockId: String, previousAttemptId: String? = nil) async
    -> MutationResult<WritingStart>
  {
    await write(invalidating: [.userSession]) { api, token in
      try await api.startWriting(
        token: token, blockId: blockId, previousAttemptId: previousAttemptId)
    }
  }

  /// "Write" on a page: the learner's own block for a written task, then its start, as one tap.
  func writeNow(goalId: String, taskKey: String? = nil) async
    -> MutationResult<(blockId: String, start: WritingStart)>
  {
    await write(invalidating: [.userSession]) { api, token in
      let blockId = try await api.createWritingBlock(token: token, goalId: goalId, taskKey: taskKey)
      return (blockId, try await api.startWriting(token: token, blockId: blockId))
    }
  }

  /// Saved even when the screen goes away first, so leaving never loses what was typed.
  func saveWritingDraft(blockId: String, draft: WritingDraft) async
    -> MutationResult<WritingDraftSave>
  {
    await saves.save {
      await self.write { api, token in
        try await api.saveWritingDraft(token: token, blockId: blockId, draft: draft)
      }
    }
  }

  /// A run that ends before the question is written fails the wait.
  func waitForWritingPrompt(generationId: String) async throws {
    guard let token = cache.session.authenticatedSession?.bearerToken else {
      throw APIError.unauthorized
    }

    for try await event in api.clients.generationEvents(id: generationId, token: token) {
      if event.status == "error" { throw APIError.unavailable }
      if event.status == "completed",
        ["writeWritingPrompt", "ready", "signUpRequired"].contains(event.step)
      {
        return
      }
    }

    throw APIError.unavailable
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

  /// Only from a learner's tap. A mock that can ask only part of its questions comes back `short`
  /// for the learner to start it knowingly (`acceptFewer`), also after the questions were written.
  func startMock(
    goalId: String, shape: MockShape, acceptFewer: Bool,
    onWriting: @escaping @MainActor (String) -> Void
  ) async -> MutationResult<MockStartOutcome> {
    await write(invalidating: [.learnerModel]) { api, token in
      let first = try await api.startMock(
        token: token, goalId: goalId, shape: shape, acceptFewer: acceptFewer)

      guard first == .needsQuestions else {
        return first
      }

      // While the goal's skill map is still drawn (a goal in onboarding), ask again a while.
      var writing = try await api.requestMockQuestions(token: token, goalId: goalId, shape: shape)

      for _ in 0..<60 where writing == .preparing {
        try await Task.sleep(for: .seconds(3))
        writing = try await api.requestMockQuestions(token: token, goalId: goalId, shape: shape)
      }

      switch writing {
      case .writing(let generationId):
        onWriting(generationId)
        try await api.waitForQuestions(token: token, generationId: generationId)
      case .refused(let limit):
        return .refused(limit)
      case .writingLimitReached(let returnsOn):
        return .writingLimitReached(returnsOn: returnsOn)
      case .needsChoice(let groups):
        return .needsChoice(choiceGroups: groups)
      case .ready, .preparing:
        break
      }

      return try await api.startMock(
        token: token, goalId: goalId, shape: shape, acceptFewer: acceptFewer, afterWriting: true)
    }
  }
}
