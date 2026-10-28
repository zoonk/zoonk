import Foundation
import Observation

/// Every conversation with the buddy the learner opened, kept for the app's lifetime so one opened
/// again (the Buddy tab after another tab, a lesson's Ask) shows at once. A session change starts
/// them over.
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

  /// The scope's conversation, made on first use. A later scope for the same conversation (a
  /// question now checked) is what its next question is about.
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

/// One conversation with the buddy: its thread, cached like any other read, and what's happening
/// in it now (a draft, a question being sent, an answer streaming in, why one failed).
@MainActor
@Observable
final class TutorConversation {
  /// The thread as read, with the questions asked here and their answers as they stream in.
  let thread: Resource<TutorThreadPage>

  var draft = ""
  private(set) var isAsking = false
  /// The question whose answer streams in now.
  private(set) var answeringID: String?
  /// Why the last question wasn't taken.
  private(set) var askFailure: TutorFailure?
  /// Why an answer didn't come, by question.
  private(set) var answerFailures: [String: TutorFailure] = [:]
  /// What an answer changed in memory, by question, until it's undone.
  private(set) var memoryChanges: [String: [TutorMemoryChange]] = [:]
  /// What the latest question did to the day's missions, when it completed one.
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

  var turns: [TutorTurn] {
    thread.value?.turns ?? []
  }

  /// A limit the learner reached: nothing can be asked until it resets, so it takes the
  /// composer's place.
  var limit: TutorFailure? {
    if let askFailure, askFailure.isLimit {
      return askFailure
    }

    return turns.last.flatMap { answerFailures[$0.id] }.flatMap { $0.isLimit ? $0 : nil }
  }

  /// Whether a new question can go: the thread is shown, nothing is being asked or answered, and
  /// every earlier question has its answer (a failed one is retried first, as on main).
  var canAsk: Bool {
    thread.value != nil && !isAsking && answeringID == nil && limit == nil
      && !turns.contains { $0.status != .completed }
  }

  /// Whether what the learner typed can go now: it has words, and a question can be asked.
  var canSendDraft: Bool {
    canAsk && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  /// Sends what the learner typed.
  func send() async {
    let question = draft.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !question.isEmpty else {
      return
    }

    await ask(question, suggestion: nil)
  }

  /// Sends a suggestion as offered; a lesson's own suggestion goes by its id so its shared answer
  /// is reused.
  func send(_ suggestion: TutorSuggestion) async {
    await ask(suggestion.label, suggestion: suggestion.lessonSuggestionID)
  }

  /// Asks the failed answer again.
  func retryAnswer(_ id: String) async {
    guard answeringID == nil, !isAsking else {
      return
    }

    await streamAnswer(id)
  }

  /// Reads a question again whose answer may have finished elsewhere.
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

  /// Saves the learner's answer to a plan change the buddy proposed.
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

  /// Undoes what an answer changed in memory.
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

  /// A stream that ended without `finish`: an answer that came is kept, none is a failure.
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

/// A question the learner can send with one tap. A lesson's own suggestion carries its id.
struct TutorSuggestion: Identifiable, Hashable, Sendable {
  let id: String
  let label: String
  var lessonSuggestionID: String?
}
