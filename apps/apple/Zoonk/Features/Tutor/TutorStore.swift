import Foundation
import Observation

@MainActor
@Observable
final class TutorStore {
  @ObservationIgnored private let api: any TutorAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var conversations: [String: TutorConversation] = [:]
  @ObservationIgnored private var owner: AuthenticatedSession?

  init(api: any TutorAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  /// A later scope for the same conversation (a question now checked) is what its next question is
  /// about.
  func conversation(_ scope: TutorScope) -> TutorConversation {
    if owner != cache.session.authenticatedSession {
      owner = cache.session.authenticatedSession
      conversations = [:]
    }

    if let conversation = conversations[scope.conversationKey] {
      conversation.scope = scope
      return conversation
    }

    let conversation = TutorConversation(scope: scope, api: api, cache: cache)
    conversations[scope.conversationKey] = conversation
    return conversation
  }
}

@MainActor
@Observable
final class TutorConversation {
  let thread: Resource<TutorThreadPage>

  var draft = ""
  private(set) var isAsking = false
  private(set) var answeringID: String?
  private(set) var askFailure: TutorFailure?
  private(set) var answerFailures: [String: TutorFailure] = [:]
  private(set) var memoryChanges: [String: [TutorMemoryChange]] = [:]
  private(set) var missionMoment: Components.Schemas.StudyMissionMoment?
  private(set) var isLoadingEarlier = false
  private(set) var earlierFailed = false

  @ObservationIgnored var scope: TutorScope
  @ObservationIgnored private let api: any TutorAPIClient
  @ObservationIgnored private let cache: AppCache
  /// A question whose reply never came, sent again with its request id so it's asked once.
  @ObservationIgnored private var unresolved: (question: String, suggestion: String?, id: String)?

  init(scope: TutorScope, api: any TutorAPIClient, cache: AppCache) {
    self.scope = scope
    self.api = api
    self.cache = cache
    let key = scope

    thread = cache.resource(audience: .signedIn) { session in
      guard let session else {
        return nil
      }

      return try await api.thread(key, cursor: nil, token: session.bearerToken)
    }
  }

  /// Mirrors main's `getShownLessonQuestionSession`: questions about a checked answer show while
  /// that answer is in view, or while one still holds up a new question.
  var turns: [TutorTurn] {
    let turns = thread.value?.turns ?? []

    guard !scope.isAboutCheckedAnswer else {
      return turns
    }

    return turns.filter { $0.about != .answer || $0.status != .completed }
  }

  /// Nothing can be asked until it resets, so it takes the composer's place.
  var limit: TutorFailure? {
    if let askFailure, askFailure.isLimit {
      return askFailure
    }

    return turns.last.flatMap { answerFailures[$0.id] }.flatMap { $0.isLimit ? $0 : nil }
  }

  /// Every earlier question needs its answer first: a failed one is retried first, as on main.
  var canAsk: Bool {
    thread.value != nil && !isAsking && answeringID == nil && limit == nil
      && !turns.contains { $0.status != .completed }
  }

  var canSendDraft: Bool {
    canAsk && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  func send() async {
    let question = draft.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !question.isEmpty else {
      return
    }

    await ask(question, suggestion: nil)
  }

  /// A lesson's own suggestion goes by its id, so its shared answer is reused.
  func send(_ suggestion: TutorSuggestion) async {
    await ask(suggestion.label, suggestion: suggestion.lessonSuggestionID)
  }

  func retryAnswer(_ id: String) async {
    guard answeringID == nil, !isAsking else {
      return
    }

    await streamAnswer(id)
  }

  func checkAgain(_ id: String) async {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    do {
      let turn = try await api.question(id: id, token: session.bearerToken)

      guard cache.session.authenticatedSession == session else {
        return
      }

      update(id) { $0 = turn }
    } catch {
      answerFailures[id] = .failed
    }
  }

  func loadEarlier() async {
    guard let page = thread.value, page.hasMore, let cursor = page.nextCursor, !isLoadingEarlier,
      let session = cache.session.authenticatedSession
    else {
      return
    }

    let revision = thread.revision
    isLoadingEarlier = true
    earlierFailed = false
    defer { isLoadingEarlier = false }

    do {
      let earlier = try await api.thread(scope, cursor: cursor, token: session.bearerToken)

      guard thread.revision == revision else {
        return
      }

      thread.update { page in
        TutorThreadPage(
          turns: earlier.turns + page.turns, hasMore: earlier.hasMore,
          nextCursor: earlier.nextCursor)
      }
    } catch {
      earlierFailed = !(error is CancellationError)
    }
  }

  func decide(
    _ change: Components.Schemas.PlanChange, in turnID: String, decision: TutorPlanChangeDecision
  ) async -> MutationResult<Void> {
    guard let goalId = scope.goalId else {
      return .failed(.unavailable)
    }

    // Declining changes only the proposal; applying or undoing changes the plan and today's
    // session.
    let result = await cache.mutate(
      invalidating: decision == .declined ? [] : [.goals, .userSession]
    ) { identity in
      try await api.decidePlanChange(
        goalId: goalId, changeId: change.id, decision: decision, token: identity.bearerToken)
    }

    switch result {
    case .done(let decided):
      update(turnID) { $0.planChange = decided }
      return .done(())
    case .failed(let error):
      return .failed(error)
    case .obsolete:
      return .obsolete
    }
  }

  func undoMemory(of turnID: String) async -> MutationResult<Void> {
    guard let changes = memoryChanges[turnID] else {
      return .obsolete
    }

    let result = await cache.mutate(invalidating: [.memory]) { identity in
      try await api.undoMemoryChanges(changes, token: identity.bearerToken)
    }

    if case .done = result {
      memoryChanges[turnID] = nil
    }

    return result
  }

  private func ask(_ question: String, suggestion: String?) async {
    guard canAsk, let session = cache.session.authenticatedSession else {
      return
    }

    let request = unresolved ?? (question, suggestion, UUID().uuidString.lowercased())
    unresolved = request
    isAsking = true
    askFailure = nil

    do {
      let asked = try await api.ask(
        scope, question: request.question, suggestion: request.suggestion, requestId: request.id,
        token: session.bearerToken)

      isAsking = false
      unresolved = nil

      guard cache.session.authenticatedSession == session else {
        return
      }

      draft = ""
      thread.update { page in
        var page = page
        page.turns.append(asked.turn)
        return page
      }

      missionMoment = asked.missionMoment

      if asked.missionMoment != nil {
        cache.invalidate([.userSession])
      }

      if asked.turn.status == .pending || asked.turn.status == .failed {
        await streamAnswer(asked.turn.id)
      }
    } catch {
      isAsking = false
      await fail(asking: error, session: session)
    }
  }

  private func fail(asking error: Error, session: AuthenticatedSession) async {
    switch error {
    case TutorFailure.conflict:
      unresolved = nil
      await thread.refresh()
    case let failure as TutorFailure:
      unresolved = nil
      askFailure = failure
    case APIError.unauthorized:
      unresolved = nil
      await cache.session.expire(session)
    case is CancellationError:
      break
    default:
      // The question may have been saved: the next send asks it again with the same id.
      askFailure = .failed
    }
  }

  private func streamAnswer(_ id: String) async {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    answeringID = id
    answerFailures[id] = nil
    update(id) {
      $0.status = .running
      $0.linksVerified = false
    }

    var text = ""
    var saved = false

    do {
      for try await event in api.answer(questionId: id, token: session.bearerToken) {
        guard cache.session.authenticatedSession == session else {
          answeringID = nil
          return
        }

        switch event {
        case .text(let delta):
          text += delta
          update(id) { $0.answer = text }
        case .savedAnswer(let answer):
          text = answer
          update(id) {
            $0.answer = answer
            $0.linksVerified = true
          }
        case .planChange(let change):
          update(id) { $0.planChange = change }
        case .planChangesReplaced(let ids):
          markReplaced(ids)
        case .toolOffer(let offer):
          update(id) { $0.toolOffer = offer }
        case .memory(let changes):
          memoryChanges[id] = changes
          cache.invalidate([.memory])
        case .finish:
          saved = true
          answeringID = nil
          update(id) { $0.status = .completed }
        }
      }

      if !saved {
        finishUnsaved(id, text: text)
      }
    } catch {
      if !saved {
        update(id) { $0.status = .failed }
        answerFailures[id] = error as? TutorFailure ?? failure(from: error)
      }

      if error as? APIError == .unauthorized {
        await cache.session.expire(session)
      }
    }

    answeringID = nil
  }

  /// An answer that came is kept; none is a failure.
  private func finishUnsaved(_ id: String, text: String) {
    if text.isEmpty {
      update(id) { $0.status = .failed }
      answerFailures[id] = .failed
    } else {
      update(id) {
        $0.status = .completed
        $0.linksVerified = true
      }
    }
  }

  private func failure(from error: Error) -> TutorFailure {
    switch error as? APIError {
    case .unauthorized:
      .signedOut
    case .notFound:
      .gone
    case .network, .unavailable, nil:
      .failed
    }
  }

  private func markReplaced(_ ids: [String]) {
    thread.update { page in
      var page = page

      for index in page.turns.indices {
        if let change = page.turns[index].planChange, ids.contains(change.id) {
          page.turns[index].planChange?.status = .replaced
        }
      }

      return page
    }
  }

  private func update(_ id: String, _ change: (inout TutorTurn) -> Void) {
    thread.update { $0.updating(id, change) }
  }
}

/// A lesson's own suggestion carries its id.
struct TutorSuggestion: Identifiable, Hashable, Sendable {
  let id: String
  let label: String
  var lessonSuggestionID: String?
}
