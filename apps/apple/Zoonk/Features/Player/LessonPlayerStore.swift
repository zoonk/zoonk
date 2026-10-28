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
  private let session: SessionStore
  private let choices: LessonTodayChoices
  private var identity: AuthenticatedSession?
  private var openedAt = Date.now
  /// The lesson's example lines are written once, after the learner's first action.
  private var exampleLinesWriting: Task<Void, Never>?
  /// Answers graded on the device that the server hasn't recorded yet, sent again before finishing.
  private var unsentChecks: [String: UnsentCheck] = [:]

  private struct UnsentCheck {
    let answer: LessonAnswer
    let attemptId: String
    let durationMs: Int
  }

  init(
    lessonId: String, studySessionId: String?, api: LessonPlayerAPI, session: SessionStore,
    choices: LessonTodayChoices = .standard
  ) {
    self.lessonId = lessonId
    self.studySessionId = studySessionId
    self.api = api
    self.session = session
    self.choices = choices
    cantTalkToday = choices.isChosenToday(.cantTalk)
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

    async let started = api.startLesson(id: lesson.id, studySessionId: studySessionId, token: token)
    async let sounds = api.getSoundsEnabled(token: token)
    async let team =
      lesson.steps.contains { $0.kind == .challenge }
      ? api.getChallengeTeam(lessonId: lesson.id, token: token) : []

    let (run, soundsEnabled, challengeTeam) = await (started, sounds, team)
    guard isCurrent(identity) else { return }

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
    while !Task.isCancelled {
      guard let state, let identity,
        state.steps.values.contains(where: { $0.isWaitingForPicture(openedAt: openedAt) })
      else {
        return
      }

      try? await Task.sleep(for: .seconds(4))
      let fresh = try? await api.getLesson(id: lessonId, token: identity.bearerToken)
      guard isCurrent(identity), case .ready(let lesson) = fresh else { continue }
      self.state?.applyPictures(from: lesson.steps)
    }
  }

  // MARK: - Example lines

  /// The learner's first action in the lesson writes its personal example lines in the
  /// background (one call for every screen with a slot), never its opening.
  private func writeExampleLinesOnce() {
    guard exampleLinesWriting == nil, let token = identity?.bearerToken,
      let first = lesson?.steps.first(where: \.hasExampleLineSlot)
    else {
      return
    }

    let api = api
    exampleLinesWriting = Task { await api.requestExampleLines(stepId: first.id, token: token) }
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

    let status = try? await api.getReadiness(id: outline.id, token: identity.bearerToken)
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

    let token = identity.bearerToken

    screen = .waiting(outline, .writing)
    let outcome = await api.writeLesson(id: outline.id, token: token)
    guard isCurrent(identity) else { return }

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
      let status = try? await api.getReadiness(id: outline.id, token: identity.bearerToken)
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
      self.state?.resolve(
        step.id, result: LessonStepResult(grade, attemptId: attemptId), counts: answer.isRecorded)
      finishIfCompleted()

      if answer.isRecorded {
        await record(step.id, answer: answer, attemptId: attemptId, durationMs: durationMs)
      }

      return
    }

    self.state?.startChecking()
    let identity = identity

    guard let runId = state.runId, let token = identity?.bearerToken else {
      self.state?.failChecking()
      return
    }

    let outcome = await api.checkStep(
      stepId: step.id, answer: answer, attemptId: attemptId, durationMs: durationMs, runId: runId,
      usedHelp: state.helped.contains(step.id), token: token)
    guard isCurrent(identity) else { return }

    switch outcome {
    case .checked(var result):
      result.answerText = answer.text
      self.state?.resolve(step.id, result: result)
    case .failed, .refused:
      self.state?.failChecking()
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

  private func record(_ stepId: String, answer: LessonAnswer, attemptId: String, durationMs: Int)
    async
  {
    let identity = identity

    guard let runId = state?.runId, let token = identity?.bearerToken else {
      unsentChecks[stepId] = UnsentCheck(
        answer: answer, attemptId: attemptId, durationMs: durationMs)
      return
    }

    let outcome = await api.checkStep(
      stepId: stepId, answer: answer, attemptId: attemptId, durationMs: durationMs, runId: runId,
      usedHelp: state?.helped.contains(stepId) == true, token: token)
    guard isCurrent(identity) else { return }

    switch outcome {
    case .checked(let result):
      unsentChecks[stepId] = nil
      state?.confirm(
        stepId, attemptId: attemptId, nextReviewAt: result.nextReviewAt,
        savedMistake: result.savedMistake)
    case .failed:
      unsentChecks[stepId] = UnsentCheck(
        answer: answer, attemptId: attemptId, durationMs: durationMs)
    case .refused:
      unsentChecks[stepId] = nil
    }
  }

  /// "Explain my answer" on a wrong typed answer: the learner asked, so it may run AI.
  func explainAnswer() async {
    let identity = identity

    guard let step = state?.currentStep, case .typedAnswer(let text) = state?.answers[step.id],
      let token = identity?.bearerToken
    else {
      return
    }

    explanations[step.id] = .loading
    let outcome = await api.explainAnswer(stepId: step.id, answer: text, token: token)
    guard isCurrent(identity) else { return }

    switch outcome {
    case .explained(let explanation): explanations[step.id] = .explained(explanation)
    case .refused(let refusal): explanations[step.id] = .refused(refusal)
    case .failed: explanations[step.id] = .failed
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

  var onCompleted: (LessonCompletionEvent) -> Void = { _ in }

  private func saveCompletion() async {
    let identity = identity

    guard let runId = state?.runId, let token = identity?.bearerToken else {
      state?.completionFailed()
      return
    }

    for (stepId, unsent) in unsentChecks {
      await record(
        stepId, answer: unsent.answer, attemptId: unsent.attemptId, durationMs: unsent.durationMs)
    }

    let outcome = await api.completeLesson(
      id: lessonId, runId: runId, skippedWritingStepIds: state?.skippedWritingStepIds ?? [],
      token: token)
    guard isCurrent(identity) else { return }

    switch outcome {
    case .completed(let summary):
      state?.completionSaved(summary)
      onCompleted(
        LessonCompletionEvent(
          lessonId: lessonId, studySessionId: studySessionId,
          isFirstCompletion: summary.isFirstCompletion))

      if isGuest, studySessionId == nil {
        fit = await api.getLessonFit(id: lessonId, token: token)
      }
    case .incomplete:
      // The run is missing an answer: the server's answers say which screen to go back to.
      let restarted = await api.startLesson(
        id: lessonId, studySessionId: studySessionId, token: token)
      guard isCurrent(identity) else { return }

      if case .success(let run) = restarted, run.runId == runId {
        state?.resync(answers: run.answers, optionalStepIds: run.optionalStepIds)
      } else {
        state?.completionFailed()
      }
    case .failed:
      state?.completionFailed()
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
