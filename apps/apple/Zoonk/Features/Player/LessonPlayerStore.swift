import Foundation
import Observation

/// One lesson on screen: it loads the lesson, starts its run and keeps the engine's state, sending
/// answers and the completion to the server. Every result is published only for the session that
/// asked for it.
@MainActor
@Observable
final class LessonPlayerStore {
  enum Screen: Equatable {
    case loading
    case failed
    case notFound
    /// A visitor: the screens need a session.
    case sessionRequired(LessonOutline)
    /// The screens are being written, or wait for the learner to ask for them.
    case waiting(LessonOutline, LessonWriting)
    case playing
  }

  enum LessonWriting: Equatable {
    /// Nothing writes it yet: "Write this lesson" on a tap.
    case notStarted
    case writing
    case failed
    case setAside
    case refused(LessonRunRefusal)
  }

  enum Explanation: Equatable {
    case loading
    case explained(String)
    case refused(LessonRunRefusal)
    case failed
  }

  let lessonId: String
  let studySessionId: String?
  private(set) var screen = Screen.loading
  private(set) var lesson: PlayableLesson?
  private(set) var state: LessonPlayerState?
  private(set) var soundsEnabled = true
  /// The colleagues' names in a challenge, in its slot order.
  private(set) var challengeTeam: [String] = []
  /// "Explain my answer" on a wrong typed answer, by screen.
  private(set) var explanations: [String: Explanation] = [:]
  /// The learner's personal example under an explanation, by screen, once read.
  private(set) var exampleLines: [String: String] = [:]
  /// Where the lesson fits, for the end of a guest's lesson.
  private(set) var fit: LessonFit?
  /// A guest outside a study session: the lesson ends with "Build my plan".
  var isGuest = false
  /// "I can't talk now" lasts the rest of the learner's day on this device.
  var cantTalkToday: Bool {
    didSet { choices.setChosenToday(.cantTalk, cantTalkToday) }
  }
  /// Any touch or scroll on the screen: a learner who touches it isn't stuck.
  var touches = 0
  /// The Ask panel is open, with the question it opened with ("Explain it more simply").
  var isAsking = false
  private(set) var askingSuggestionId: String?

  private let api: LessonPlayerAPI
  private let cache: AppCache
  private var session: SessionStore { cache.session }
  private let choices: LessonTodayChoices
  private var identity: AuthenticatedSession?
  private(set) var openedAt = Date.now
  /// The lesson's example lines are written once, after the learner's first action.
  private var exampleLinesWriting: Task<Void, Never>?
  /// The device-graded answers being sent now, by screen, so finishing waits for them.
  private var saving: [String: Task<Void, Never>] = [:]

  init(
    lessonId: String, studySessionId: String?, api: LessonPlayerAPI, cache: AppCache,
    choices: LessonTodayChoices = .standard
  ) {
    self.lessonId = lessonId
    self.studySessionId = studySessionId
    self.api = api
    self.cache = cache
    self.choices = choices
    cantTalkToday = choices.isChosenToday(.cantTalk)
  }

  /// A write for the session that opened the lesson, through the app's shared write rule: a 401
  /// signs that session out (the lesson then reloads for whoever is signed in), and a result for a
  /// session that ended meanwhile comes back `.obsolete`, never published.
  private func write<Value: Sendable>(
    invalidating domains: Set<DataDomain> = [], _ operation: (String) async throws -> Value
  ) async -> MutationResult<Value> {
    let expected = identity

    return await cache.mutate(invalidating: domains) { identity in
      guard identity == expected else {
        throw CancellationError()
      }

      return try await operation(identity.bearerToken)
    }
  }

  /// Opens the Ask panel, with a suggestion ready to send when it came from an offer.
  func ask(suggestionId: String? = nil) {
    askingSuggestionId = suggestionId
    isAsking = true
  }

  // MARK: - Loading

  /// Reads the lesson, then starts (or resumes) its run. An unwritten lesson waits for the learner's
  /// tap, since writing it runs AI.
  func load() async {
    let identity = session.authenticatedSession
    self.identity = identity
    screen = .loading

    do {
      let load = try await api.getLesson(id: lessonId, token: identity?.bearerToken)
      guard isCurrent(identity) else { return }

      switch load {
      case .sessionRequired(let outline):
        screen = .sessionRequired(outline)
      case .notGenerated(let outline):
        await showWaiting(outline, identity: identity)
      case .ready(let lesson):
        await start(lesson, identity: identity)
      }
    } catch is CancellationError {
      return
    } catch APIError.notFound {
      screen = .notFound
    } catch {
      screen = .failed
    }
  }

  private func start(_ lesson: PlayableLesson, identity: AuthenticatedSession?) async {
    guard let token = identity?.bearerToken else {
      screen = .sessionRequired(
        LessonOutline(id: lesson.id, title: lesson.title, description: "", estimatedMinutes: 0))
      return
    }

    let api = api
    let studySessionId = studySessionId
    async let sounds = api.getSoundsEnabled(token: token)
    async let team =
      lesson.steps.contains { $0.kind == .challenge }
      ? api.getChallengeTeam(lessonId: lesson.id, token: token) : []

    let started = await write { token in
      try await api.startLesson(id: lesson.id, studySessionId: studySessionId, token: token)
    }

    let (soundsEnabled, challengeTeam) = await (sounds, team)
    guard isCurrent(identity) else { return }

    let run: Result<LessonRunStart, LessonRunRefusal>

    switch started {
    case .done(let result): run = result
    case .failed: run = .failure(.failed)
    case .obsolete: return
    }

    var state = LessonPlayerState(lessonId: lesson.id, steps: lesson.steps)

    switch run {
    case .success(let run):
      state.startRun(
        runId: run.runId, answers: run.answers, startedAt: run.startedAt,
        hyperdrive: run.hyperdrive, optionalStepIds: run.optionalStepIds, support: run.support)
    case .failure(let refusal):
      state.refuseRun(refusal)
    }

    leaveOutUnplayable(&state)

    // "Can't write now" lasts the rest of the learner's day on this device.
    if choices.isChosenToday(.cantWrite) {
      state.skipWriting(opening: true)
    }

    self.lesson = lesson
    self.state = state
    self.soundsEnabled = soundsEnabled
    self.challengeTeam = challengeTeam
    openedAt = .now
    screen = .playing
  }

  // MARK: - Late pictures

  /// While a screen still waits for its picture (the lesson was written moments ago), the lesson
  /// is read again every few seconds, as the API asks, until the pictures come or the wait ends.
  func followLatePictures() async {
    while !Task.isCancelled, let state, let identity,
      state.steps.values.contains(where: \.imagePending)
    {
      let isLastRead = !state.steps.values.contains { $0.isWaitingForPicture(openedAt: openedAt) }

      if !isLastRead {
        try? await Task.sleep(for: .seconds(4))
      }

      let fresh = try? await api.getLesson(id: lessonId, token: identity.bearerToken)
      guard isCurrent(identity) else { return }

      if case .ready(let lesson) = fresh {
        self.state?.applyPictures(from: lesson.steps)
      }

      // A numbered picture that never came leaves its question out once the wait is over.
      self.state?.leaveOutLostPictures(openedAt: openedAt)

      if isLastRead {
        return
      }
    }
  }

  // MARK: - Example lines

  /// The learner's first action in the lesson writes its personal example lines in the
  /// background (one call for every screen with a slot), never its opening.
  private func writeExampleLinesOnce() {
    guard exampleLinesWriting == nil, let first = lesson?.steps.first(where: \.hasExampleLineSlot)
    else {
      return
    }

    let api = api
    exampleLinesWriting = Task {
      _ = await write { token in try await api.requestExampleLines(stepId: first.id, token: token) }
    }
  }

  /// Reads the screen's line once the lesson's write (if one started) settled.
  func loadExampleLine(stepId: String) async {
    guard exampleLines[stepId] == nil, let identity else {
      return
    }

    await exampleLinesWriting?.value
    let line = await api.getExampleLine(stepId: stepId, token: identity.bearerToken)
    guard isCurrent(identity), let line else { return }
    exampleLines[stepId] = line
  }

  /// Interactions without a renderer can't be answered here, so they're left out of the run.
  var isUnplayable: (LessonStep) -> Bool = { _ in false }

  private func leaveOutUnplayable(_ state: inout LessonPlayerState) {
    state.skipSteps(state.queue.filter { state.steps[$0].map(isUnplayable) ?? false })
  }

  private func showWaiting(_ outline: LessonOutline, identity: AuthenticatedSession?) async {
    guard let identity else {
      screen = .waiting(outline, .notStarted)
      return
    }

    let status = await readiness(outline.id, identity: identity)
    guard isCurrent(identity) else { return }

    switch status {
    case .generating: screen = .waiting(outline, .writing)
    case .ready: await load()
    case .failed: screen = .waiting(outline, .failed)
    case .notStarted, nil: screen = .waiting(outline, .notStarted)
    }

    if case .waiting(_, .writing) = screen {
      await followWriting(outline, identity: identity)
    }
  }

  /// "Write this lesson": the learner asked, so the lesson is written now.
  func writeLesson() async {
    guard case .waiting(let outline, _) = screen, let identity else {
      return
    }

    screen = .waiting(outline, .writing)
    let api = api
    let written = await write { token in try await api.writeLesson(id: outline.id, token: token) }
    guard isCurrent(identity) else { return }

    let outcome: LessonWritingOutcome

    switch written {
    case .done(let result): outcome = result
    case .failed: outcome = .failed
    case .obsolete: return
    }

    switch outcome {
    case .ready: await load()
    case .writing: await followWriting(outline, identity: identity)
    case .setAside: screen = .waiting(outline, .setAside)
    case .refused(let refusal): screen = .waiting(outline, .refused(refusal))
    case .failed: screen = .waiting(outline, .failed)
    }
  }

  /// Checks every few seconds until the screens are written; reading never writes anything.
  private func followWriting(_ outline: LessonOutline, identity: AuthenticatedSession) async {
    while !Task.isCancelled, isCurrent(identity), case .waiting(_, .writing) = screen {
      try? await Task.sleep(for: .seconds(3))
      let status = await readiness(outline.id, identity: identity)
      guard isCurrent(identity), case .waiting(_, .writing) = screen else { return }

      switch status {
      case .ready:
        await load()
        return
      case .failed:
        screen = .waiting(outline, .failed)
      default:
        continue
      }
    }
  }

  /// Whether the lesson is written yet. A 401 signs that identity out, so the screen reloads.
  private func readiness(_ lessonId: String, identity: AuthenticatedSession) async
    -> Components.Schemas.LessonReadiness.StatusPayload?
  {
    do {
      return try await api.getReadiness(id: lessonId, token: identity.bearerToken)
    } catch APIError.unauthorized {
      await session.expire(identity)
      return nil
    } catch {
      return nil
    }
  }

  // MARK: - The learner's actions

  func select(_ answer: LessonAnswer?) {
    guard let stepId = state?.currentStep?.id else { return }
    state?.select(answer, for: stepId)
  }

  func continueLesson() {
    writeExampleLinesOnce()
    state?.continueLesson()
    finishIfCompleted()
  }

  func goBack() {
    state?.goBack()
  }

  /// "Explain first": the explanation now, the question right after it.
  func explainFirst() {
    writeExampleLinesOnce()
    state?.explainFirst()
  }

  /// "I already know this": the lesson's checks, then its end if they're all right.
  func knowThis() {
    writeExampleLinesOnce()
    state?.knowThis()
  }

  /// "I don't know yet" on a written screen.
  func dontKnow() {
    guard let stepId = state?.currentStep?.id else { return }
    state?.dontKnow(stepId)
  }

  /// "Can't write now": no writing for the rest of today, in this lesson and the next ones.
  func skipWriting() {
    choices.setChosenToday(.cantWrite, true)
    state?.skipWriting()
    finishIfCompleted()
  }

  /// "Write again": takes back "Can't write now" and puts this lesson's writing back.
  func restoreWriting() {
    choices.setChosenToday(.cantWrite, false)
    state?.restoreWriting()
  }

  /// Check: device-graded answers show their verdict at once and are recorded in the background;
  /// typed and spoken answers (and activities graded only by the server) wait for the server.
  func check(gradeActivity: ((ActivityStepContent, ActivityAnswer) -> Bool)? = nil) async {
    guard let state, state.phase == .playing, let step = state.currentStep,
      let answer = state.answers[step.id]
    else {
      return
    }

    writeExampleLinesOnce()
    let attemptId = UUID().uuidString.lowercased()
    let durationMs = Int(Date.now.timeIntervalSince(state.stepStartedAt) * 1000)

    if let grade = LessonGrading.grade(answer, step: step, gradeActivity: gradeActivity) {
      let unsaved =
        answer.isRecorded
        ? LessonPlayerState.UnsavedAnswer(
          answer: answer, attemptId: attemptId, durationMs: durationMs,
          usedHelp: state.helped.contains(step.id))
        : nil

      // The answer counts as unsaved before anything moves on, so finishing waits for it.
      self.state?.resolve(
        step.id, result: LessonStepResult(grade, attemptId: attemptId), counts: answer.isRecorded,
        saving: unsaved)

      if let unsaved {
        send(step.id, unsaved)
      }

      finishIfCompleted()
      return
    }

    self.state?.startChecking()

    guard let runId = state.runId else {
      self.state?.failChecking()
      return
    }

    let api = api
    let usedHelp = state.helped.contains(step.id)
    let checked = await write { token in
      try await api.checkStep(
        stepId: step.id, answer: answer, attemptId: attemptId, durationMs: durationMs, runId: runId,
        usedHelp: usedHelp, token: token)
    }

    switch checked {
    case .done(.checked(var result)):
      result.answerText = answer.text
      self.state?.resolve(step.id, result: result)
    case .done(.failed), .done(.refused), .failed:
      self.state?.failChecking()
    case .obsolete:
      break
    }
  }

  /// A spoken answer the voice feature graded.
  func resolveSpoken(_ verdict: SpokenAnswerVerdict) {
    guard let stepId = state?.currentStep?.id else { return }
    var result = LessonStepResult(
      isCorrect: verdict.isCorrect, answerText: verdict.transcript, correctAnswer: nil,
      feedback: verdict.feedback)
    result.score = verdict.score
    result.wordsToPractice = verdict.wordsToPractice

    if case .spokenAnswer(let content, _) = state?.currentStep?.content, !verdict.isCorrect {
      result.correctAnswer = content.targetText
    }

    state?.resolve(stepId, result: result)
  }

  /// Sends a device-graded answer once, keeping the task so finishing can wait for it.
  private func send(_ stepId: String, _ unsaved: LessonPlayerState.UnsavedAnswer) {
    guard saving[stepId] == nil else {
      return
    }

    saving[stepId] = Task {
      await record(stepId, unsaved)
      saving[stepId] = nil
    }
  }

  /// One answer to the server. Accepted (or refused for good, such as a finished run), it stops
  /// holding the lesson back; a failed send stays unsaved and goes again with the same attempt id.
  private func record(_ stepId: String, _ unsaved: LessonPlayerState.UnsavedAnswer) async {
    guard let runId = state?.runId else {
      return
    }

    let api = api
    let recorded = await write { token in
      try await api.checkStep(
        stepId: stepId, answer: unsaved.answer, attemptId: unsaved.attemptId,
        durationMs: unsaved.durationMs, runId: runId, usedHelp: unsaved.usedHelp, token: token)
    }

    switch recorded {
    case .done(.checked(let result)):
      state?.confirm(
        stepId, attemptId: unsaved.attemptId, nextReviewAt: result.nextReviewAt,
        savedMistake: result.savedMistake)
    case .done(.refused):
      state?.answerSaved(stepId, attemptId: unsaved.attemptId)
    case .done(.failed), .failed, .obsolete:
      // Stays unsaved: finishing sends it again under the same attempt id.
      break
    }
  }

  /// "Explain my answer" on a wrong typed answer: the learner asked, so it may run AI.
  func explainAnswer() async {
    guard let step = state?.currentStep, case .typedAnswer(let text) = state?.answers[step.id]
    else {
      return
    }

    explanations[step.id] = .loading
    let api = api
    let explained = await write { token in
      try await api.explainAnswer(stepId: step.id, answer: text, token: token)
    }

    switch explained {
    case .done(.explained(let explanation)): explanations[step.id] = .explained(explanation)
    case .done(.refused(let refusal)): explanations[step.id] = .refused(refusal)
    case .done(.failed), .failed: explanations[step.id] = .failed
    case .obsolete: explanations[step.id] = nil
    }
  }

  // MARK: - Finishing

  /// Saves a lesson that just reached its end.
  private func finishIfCompleted() {
    guard state?.completion?.status == .saving else { return }
    Task { await saveCompletion() }
  }

  /// "Finish" on a lesson every screen of which was answered before, or "Try again" after a failed save.
  func finish() async {
    state?.completionSaving()
    await saveCompletion()
  }

  private func saveCompletion() async {
    let identity = identity

    guard let runId = state?.runId, let token = identity?.bearerToken else {
      state?.completionFailed()
      return
    }

    // Every answer reaches the server before the run is finished: the ones on their way, then any
    // that failed, sent again under their attempt ids.
    for task in saving.values {
      await task.value
    }

    for (stepId, unsaved) in state?.unsavedAnswers ?? [:] {
      await record(stepId, unsaved)
    }

    guard isCurrent(identity) else { return }

    guard state?.unsavedAnswers.isEmpty == true else {
      state?.completionFailed()
      return
    }

    let api = api
    let lessonId = lessonId
    let studySessionId = studySessionId
    let skippedWritingStepIds = state?.skippedWritingStepIds ?? []

    // A finished lesson changes the learner's progress and learner model, as main revalidates
    // after `completeLibraryLesson`: the summary, Today, statistics and chapters follow.
    let completed = await write(invalidating: [.userProgress, .learnerModel]) { token in
      try await api.completeLesson(
        id: lessonId, runId: runId, skippedWritingStepIds: skippedWritingStepIds, token: token)
    }

    switch completed {
    case .done(.completed(let summary)):
      state?.completionSaved(summary)

      if isGuest, studySessionId == nil {
        fit = await api.getLessonFit(id: lessonId, token: token)
      }
    case .done(.incomplete):
      // The run is missing an answer: the server's answers say which screen to go back to.
      let restarted = await write { token in
        try await api.startLesson(id: lessonId, studySessionId: studySessionId, token: token)
      }

      if case .done(.success(let run)) = restarted, run.runId == runId {
        state?.resync(answers: run.answers, optionalStepIds: run.optionalStepIds)
      } else if case .obsolete = restarted {
        return
      } else {
        state?.completionFailed()
      }
    case .done(.failed), .failed:
      state?.completionFailed()
    case .obsolete:
      break
    }
  }

  // MARK: - Identity

  private func isCurrent(_ identity: AuthenticatedSession?) -> Bool {
    !Task.isCancelled && session.authenticatedSession == identity
  }
}

extension LessonAnswer {
  /// The learner's words, for a typed or spoken answer's result.
  var text: String? {
    switch self {
    case .typedAnswer(let text), .spokenAnswer(let text): text
    default: nil
    }
  }
}
