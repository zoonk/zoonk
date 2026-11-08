import Foundation
import Observation

/// Every result is published only for the session that asked for it.
@MainActor
@Observable
final class LessonPlayerStore {
  enum Screen: Equatable {
    case loading
    case failed
    case notFound
    case sessionRequired(LessonOutline)
    /// The screens are being written, or wait for the learner to ask for them.
    case waiting(LessonOutline, LessonWriting)
    case playing
  }

  struct WarmUp: Equatable {
    let deckID: String
    let outline: LessonOutline
  }

  enum LessonWriting: Equatable {
    /// Nothing writes it yet: "Write this lesson" on a tap.
    case notStarted
    case writing
    /// Written while its wait dealt warm-up cards: it opens once that wait moves on.
    case written
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
  private(set) var studySessionId: String?
  private let opening: LessonOpening?
  private var activated: Bool
  private let onOpened: @MainActor (StudyBlockOpening) -> Void
  private var starting: Task<Void, Never>?
  /// Opened from a public catalog page, where main asks the first question: answering it counts as
  /// main's catalog answer, and a guest's lesson ends with "Build my plan". Opened anywhere else in
  /// the app, a guest's lesson ends as a learner's.
  private let fromCatalog: Bool
  private(set) var screen = Screen.loading
  private(set) var writingProgress = GenerationWait(kind: .lesson).started
  private var progressRun: String?
  private(set) var warmUp: WarmUp?
  /// What's ready to do while the lesson is written, or instead of it.
  private(set) var alternative: Components.Schemas.ReadyAlternative?
  private(set) var lesson: PlayableLesson?
  private(set) var state: LessonPlayerState?
  private(set) var soundsEnabled = true
  private(set) var challengeTeam: [String] = []
  private(set) var explanations: [String: Explanation] = [:]
  private(set) var exampleLines: [String: String] = [:]
  private(set) var fit: LessonFit?
  var isGuest = false
  var endsAsGuest: Bool { isGuest && fromCatalog }
  /// From a send that failed until every held answer is saved, so a lesson that opens with answers
  /// held and sends them at once never shows it.
  var hasUnsavedAnswers: Bool { sendFailed && !held.isEmpty }
  /// "I can't talk now" lasts the rest of the learner's day on this device.
  var cantTalkToday: Bool {
    didSet { choices.setChosenToday(.cantTalk, cantTalkToday) }
  }
  /// The microphone was off when a spoken screen tried it, so spoken screens are typed until the
  /// learner asks to speak again. Kept here, since both halves of a spread show it.
  var isMicBlocked = false
  /// The screen and answer round whose "From the lesson" is open, so a fold keeps it open and the
  /// screen's next round starts it folded.
  var openRecap: String?
  /// Any touch or scroll on the screen: a learner who touches it isn't stuck.
  var touches = 0
  var isAsking = false
  private var askingOffer: LessonTutorOffer?
  /// The lesson shows as a spread, where Ask opens beside it; elsewhere Ask is a sheet. Kept by the
  /// stage, which measures it. Once Ask is beside the lesson, closing iPhone Duo doesn't bring its
  /// sheet back.
  var isSpread = false {
    didSet {
      if isSpread {
        isAskingInSheet = false
      }
    }
  }
  /// Ask was opened where it's a sheet over the lesson. Only such a tap shows the sheet: closing
  /// iPhone Duo with Ask beside the lesson keeps the lesson in view, and opening it again brings Ask
  /// back beside it.
  private(set) var isAskingInSheet = false

  private let api: LessonPlayerAPI
  private let cache: AppCache
  private let preferences: Resource<LearningPreferences>
  private let lessonResource: Resource<LessonLoad>
  private var session: SessionStore { cache.session }
  private let choices: LessonTodayChoices
  private let defaults: UserDefaults
  private let blockFinished: @MainActor (_ sessionID: String, BlockMoment) -> Void
  /// A start that opened a study block names its session, which the session screen shows.
  private let sessionStarted: @MainActor (_ sessionID: String) -> Void
  private var identity: AuthenticatedSession?
  private(set) var openedAt = Date.now
  /// The lesson's example lines are written once, after the learner's first action.
  private var exampleLinesWriting: Task<Void, Never>?
  /// Device-graded answers the server hasn't taken yet, oldest first: the lesson can't finish
  /// without them.
  private(set) var held: [HeldAnswer] = []
  /// Device-graded answers given before the run started, held with its id once it does.
  private var heldForRun: [(_ runId: String) -> HeldAnswer] = []
  private var heldOnDevice: HeldLessonAnswers?
  private var sendFailed = false
  /// Each screen's held answers being sent now, so finishing waits for them.
  private var saving: [String: Task<Void, Never>] = [:]
  private var reportedAbandonment = false
  @ObservationIgnored let promptAudio = LessonPromptAudio()
  @ObservationIgnored private var works: [String: (round: Int, work: ActivityWork)] = [:]

  init(
    lessonId: String, studySessionId: String?, fromCatalog: Bool = false,
    opening: LessonOpening? = nil, activated: Bool = false,
    onOpened: @escaping @MainActor (StudyBlockOpening) -> Void = { _ in }, api: LessonPlayerAPI,
    cache: AppCache,
    preferences: Resource<LearningPreferences>,
    lessonResource: Resource<LessonLoad>,
    choices: LessonTodayChoices = .standard,
    defaults: UserDefaults = .standard,
    blockFinished: @escaping @MainActor (_ sessionID: String, BlockMoment) -> Void = { _, _ in },
    sessionStarted: @escaping @MainActor (_ sessionID: String) -> Void = { _ in }
  ) {
    self.lessonId = lessonId
    self.studySessionId = studySessionId
    self.fromCatalog = fromCatalog
    self.opening = opening
    self.activated = activated
    self.onOpened = onOpened
    self.api = api
    self.cache = cache
    self.preferences = preferences
    self.lessonResource = lessonResource
    self.choices = choices
    self.defaults = defaults
    self.blockFinished = blockFinished
    self.sessionStarted = sessionStarted
    cantTalkToday = choices.isChosenToday(.cantTalk)
  }

  /// A 401 signs the session that opened the lesson out, and the lesson reloads for whoever is
  /// signed in.
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

  func work(for stepId: String, round: Int) -> ActivityWork {
    if let kept = works[stepId], kept.round == round {
      return kept.work
    }

    let work = ActivityWork()
    works[stepId] = (round, work)
    return work
  }

  /// Ask stays open as the lesson moves on, and only the screen an offer was made about starts with
  /// it, so moving on never asks again.
  func startingOffer(about stepId: String?) -> LessonTutorOffer? {
    askingOffer.flatMap { $0.stepId == stepId ? $0 : nil }
  }

  func ask(suggestionId: String? = nil, sendsAtOnce: Bool = false) {
    askingOffer = lesson?.tutorSuggestions.first { $0.id.rawValue == suggestionId }.map {
      LessonTutorOffer(suggestion: $0, stepId: state?.currentStep?.id, sendsAtOnce: sendsAtOnce)
    }
    isAskingInSheet = !isSpread
    isAsking = true
  }

  /// What the buddy offers beside the lesson. Beside a screen with "I didn't get this", that button
  /// is the one way to ask for `simpler`.
  var suggestionsBeside: [Components.Schemas.LessonTutorSuggestion] {
    let suggestions = lesson?.tutorSuggestions ?? []

    guard let lesson, let step = state?.currentStep, lesson.offersDidntGetIt(on: step) else {
      return suggestions
    }

    return suggestions.filter { $0.id != .simpler }
  }

  /// An unwritten lesson waits for the learner's tap, since writing it runs AI.
  func load(refresh: Bool = false) async {
    let identity = session.authenticatedSession

    // Another session's answers are never sent with this one's.
    if identity != self.identity {
      held = []
      heldOnDevice = nil
    }

    starting?.cancel()
    starting = nil
    if identity == self.identity, case .refused = state?.run, !refresh {
      beginStart()
      await starting?.value
      return
    }
    self.identity = identity
    screen = .loading

    do {
      let revision = lessonResource.revision
      if refresh {
        await lessonResource.refresh()
      } else {
        await lessonResource.load()
      }
      guard isCurrent(identity) else { return }
      // A failed refresh keeps the cached outline. Don't treat it as a new response and
      // restart the generation-status loop after the server said the lesson was ready.
      guard !refresh || lessonResource.revision != revision else {
        screen = .failed
        return
      }

      guard let load = lessonResource.value else {
        if case .failed(let error) = lessonResource.state {
          throw error
        }
        return
      }

      switch load {
      case .sessionRequired(let outline):
        screen = .sessionRequired(outline)
      case .notGenerated(let outline):
        await showWaiting(outline, identity: identity)
      case .ready(let lesson):
        guard identity != nil else {
          screen = .sessionRequired(
            LessonOutline(id: lesson.id, title: lesson.title, description: "", estimatedMinutes: 0))
          return
        }
        self.lesson = lesson
        heldForRun = []
        var state = LessonPlayerState(
          lessonId: lesson.id, steps: lesson.steps, hasMap: lesson.summary != nil)
        leaveOutUnplayable(&state)
        self.state = state
        openedAt = .now
        // Written content can paint before admission; server actions await the run.
        screen = .playing
        if opening == nil || activated {
          beginStart()
          await starting?.value
        }
      }
    } catch is CancellationError {
      return
    } catch APIError.notFound {
      screen = .notFound
    } catch {
      screen = .failed
    }
  }

  func cancelStart() { starting?.cancel() }

  func activate() {
    // A restored lesson or deep link cannot owe preparation until a learner acts.
    activated = true
    beginStart()
  }

  private func beginStart() {
    guard starting == nil, let lesson, let identity else { return }
    starting = Task { await start(lesson, identity: identity) }
  }

  func ensureRun() async -> Bool {
    activate()
    await starting?.value
    return state?.runId != nil && !Task.isCancelled
  }

  private func start(_ lesson: PlayableLesson, identity: AuthenticatedSession?) async {
    guard let token = identity?.bearerToken else {
      screen = .sessionRequired(
        LessonOutline(id: lesson.id, title: lesson.title, description: "", estimatedMinutes: 0))
      return
    }

    let api = api
    let studySessionId = studySessionId
    let preferences = preferences
    async let sounds: Void = preferences.load()
    async let team =
      lesson.steps.contains { $0.kind == .challenge }
      ? api.getChallengeTeam(lessonId: lesson.id, token: token) : []

    // Answers held from an earlier visit go first, so the run they place the learner by has them;
    // the run starts whatever happened to them.
    heldOnDevice = session.account.map {
      HeldLessonAnswers(learnerId: $0.user.id, lessonId: lesson.id, defaults: defaults)
    }
    held = heldOnDevice?.read() ?? []
    sendHeldAnswers()
    await heldAnswersSent()

    let started = await write(invalidating: opening == nil ? [] : [.userProgress, .userSession]) {
      token in
      try await api.startLesson(
        id: lesson.id, studySessionId: studySessionId, opening: opening, token: token)
    }

    let (_, challengeTeam) = await (sounds, team)
    guard isCurrent(identity) else { return }

    let run: LessonStartOutcome

    switch started {
    case .done(let result): run = result
    case .failed: run = .failure(.failed)
    case .obsolete: return
    }

    switch run {
    case .success(let run):
      self.studySessionId = run.sessionId
      if opening != nil, let sessionId = run.sessionId { sessionStarted(sessionId) }
      self.state?.startRun(
        runId: run.runId, answers: run.answers, held: held.map(\.runAnswer),
        startedAt: run.startedAt, hyperdrive: run.hyperdrive, optionalStepIds: run.optionalStepIds)
      for answer in heldForRun {
        hold(answer(run.runId))
      }
      heldForRun = []
      sendHeldAnswers()
    case .failure(let refusal): self.state?.refuseRun(refusal)
    case .opened(let opening):
      onOpened(opening)
      return
    }
    guard var state = self.state else { return }

    leaveOutUnplayable(&state)

    // "Can't write now" lasts the rest of the learner's day on this device.
    if choices.isChosenToday(.cantWrite) {
      state.skipWriting(opening: true)
    }

    self.lesson = lesson
    self.state = state
    works = [:]
    openRecap = nil
    soundsEnabled = preferences.value?.soundsEnabled ?? true
    self.challengeTeam = challengeTeam
    screen = .playing
  }

  /// Every few seconds, as the API asks, until the pictures come or the wait ends.
  func followLatePictures() async {
    while !Task.isCancelled, let state, let identity,
      state.steps.values.contains(where: \.imagePending)
    {
      let isLastRead = !state.steps.values.contains { $0.isWaitingForPicture(openedAt: openedAt) }

      if !isLastRead {
        try? await Task.sleep(for: .seconds(4))
      }

      await lessonResource.refresh()
      guard isCurrent(identity) else { return }

      if case .ready(let lesson) = lessonResource.value {
        self.state?.applyPictures(from: lesson.steps)
      }

      // A numbered picture that never came leaves its question out once the wait is over.
      self.state?.leaveOutLostPictures(openedAt: openedAt)

      if isLastRead {
        return
      }
    }
  }

  /// The learner's first action writes the example lines, never the lesson's opening.
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

    let lesson = await readiness(outline.id, identity: identity)
    guard isCurrent(identity) else { return }

    if let deckID = lesson?.warmUpId {
      warmUp = WarmUp(deckID: deckID, outline: outline)
    }

    alternative = lesson?.alternative?.value1

    switch lesson?.status {
    case .generating: waitForWriting(outline)
    case .ready: await load(refresh: true)
    case .failed: screen = .waiting(outline, .failed)
    case .notStarted, nil: screen = .waiting(outline, .notStarted)
    }

    if case .waiting(_, .writing) = screen {
      await followWriting(outline, run: lesson?.generationId, identity: identity)
    }
  }

  /// Once a written lesson's wait moves on.
  func open() async {
    guard case .waiting(_, .written) = screen else {
      return
    }

    await load(refresh: true)
  }

  /// Only on the learner's tap.
  func writeLesson() async {
    guard case .waiting(let outline, _) = screen, let identity else {
      return
    }

    waitForWriting(outline)
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
    case .ready: await load(refresh: true)
    case .writing(let run): await followWriting(outline, run: run, identity: identity)
    case .setAside: screen = .waiting(outline, .setAside)
    case .refused(let refusal): screen = .waiting(outline, .refused(refusal))
    case .failed: screen = .waiting(outline, .failed)
    }
  }

  /// Reading never writes anything. A run that ended without the lesson, or a follow that couldn't
  /// finish, leaves it to the learner to try again.
  private func followWriting(
    _ outline: LessonOutline, run: String?, identity: AuthenticatedSession
  ) async {
    let lesson = await signingOutOnUnauthorized(identity) {
      try await api.followWriting(id: outline.id, run: run, token: identity.bearerToken) {
        [weak self] run, event in
        self?.recordProgress(event, of: run, for: identity)
      }
    }

    guard !Task.isCancelled, isCurrent(identity), case .waiting(_, .writing) = screen else {
      return
    }

    switch lesson?.status {
    case .ready where warmUp != nil: screen = .waiting(outline, .written)
    case .ready: await load(refresh: true)
    case .failed, nil: screen = .waiting(outline, .failed)
    case .generating, .notStarted: screen = .waiting(outline, .notStarted)
    }
  }

  private func waitForWriting(_ outline: LessonOutline) {
    screen = .waiting(outline, .writing)
    progressRun = nil
    writingProgress = GenerationWait(kind: .lesson).started
  }

  /// A run that takes over from one that stopped starts the steps over.
  private func recordProgress(
    _ event: GenerationEvent, of run: String, for identity: AuthenticatedSession
  ) {
    guard isCurrent(identity) else {
      return
    }

    if run != progressRun {
      progressRun = run
      writingProgress = GenerationWait(kind: .lesson).started
    }

    writingProgress.apply(event)
  }

  private func readiness(_ lessonId: String, identity: AuthenticatedSession) async
    -> Components.Schemas.LessonReadiness?
  {
    await signingOutOnUnauthorized(identity) {
      try await api.getReadiness(id: lessonId, token: identity.bearerToken)
    }
  }

  /// A 401 signs that identity out, so the screen reloads.
  private func signingOutOnUnauthorized<Value>(
    _ identity: AuthenticatedSession, _ read: () async throws -> Value
  ) async -> Value? {
    do {
      return try await read()
    } catch APIError.unauthorized {
      await session.expire(identity)
      return nil
    } catch {
      return nil
    }
  }

  func select(_ answer: LessonAnswer?) {
    activate()
    guard let stepId = state?.currentStep?.id else { return }
    state?.select(answer, for: stepId)
  }

  func continueLesson() {
    activate()
    writeExampleLinesOnce()
    sendHeldAnswers()
    state?.continueLesson()
    finishIfCompleted()
  }

  func goBack() {
    state?.goBack()
  }

  func explainFirst() {
    activate()
    writeExampleLinesOnce()
    state?.explainFirst()
  }

  func knowThis() {
    activate()
    writeExampleLinesOnce()
    state?.knowThis()
  }

  func dontKnow() {
    guard let stepId = state?.currentStep?.id else { return }
    state?.dontKnow(stepId)
  }

  func skipWriting() {
    activate()
    choices.setChosenToday(.cantWrite, true)
    state?.skipWriting()
    finishIfCompleted()
  }

  /// Once, the first time the learner leaves a started lesson unfinished: closing it or leaving the
  /// app.
  func reportAbandonment() {
    guard !reportedAbandonment, let state, let event = AnalyticsEvent.abandonment(of: state) else {
      return
    }

    reportedAbandonment = true
    UsageAnalytics.track(event)
  }

  func restoreWriting() {
    choices.setChosenToday(.cantWrite, false)
    state?.restoreWriting()
  }

  /// Device-graded answers show their verdict at once and are recorded in the background; typed and
  /// spoken answers (and activities graded only by the server) wait for the server.
  func check(gradeActivity: ((ActivityStepContent, ActivityAnswer) -> Bool)? = nil) async {
    guard let state, state.phase == .playing, let step = state.currentStep,
      let answer = state.answers[step.id]
    else {
      return
    }

    activate()
    writeExampleLinesOnce()
    let attemptId = UUID().uuidString.lowercased()
    let durationMs = Int(Date.now.timeIntervalSince(state.stepStartedAt) * 1000)

    if step.kind == .hook || (fromCatalog && state.position == 0) {
      UsageAnalytics.track(.hookAnswered(lessonID: state.lessonId))
    }

    if let grade = LessonGrading.grade(answer, step: step, gradeActivity: gradeActivity) {
      if case .activity(let content) = step.content {
        UsageAnalytics.track(.activityUsed(lessonID: state.lessonId, template: content.template))
      }

      // Held before anything moves on, so finishing waits for it: match columns finishes a lesson
      // on its own check.
      if answer.isRecorded {
        let usedHelp = state.helped.contains(step.id)
        let answeredAt = Date.now
        let held = { runId in
          HeldAnswer(
            stepId: step.id, answer: answer, attemptId: attemptId, runId: runId,
            durationMs: durationMs, usedHelp: usedHelp, isCorrect: grade.isCorrect,
            answeredAt: answeredAt)
        }

        if let runId = self.state?.runId {
          hold(held(runId))
        } else {
          heldForRun.append(held)
        }
      }

      self.state?.resolve(
        step.id, result: LessonStepResult(grade, attemptId: attemptId), counts: answer.isRecorded)
      sendHeldAnswers()
      finishIfCompleted()
      return
    }

    self.state?.startChecking()

    guard await ensureRun(), let runId = self.state?.runId else {
      self.state?.failChecking()
      return
    }

    guard self.state?.phase == .checking, self.state?.currentStep?.id == step.id else { return }

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
      sendHeldAnswers()
    case .done(.failed), .done(.refused), .failed:
      self.state?.failChecking()
    case .obsolete:
      break
    }
  }

  func resolveSpoken(_ verdict: SpokenAnswerVerdict, stepId: String) {
    var result = LessonStepResult(
      isCorrect: verdict.isCorrect, answerText: verdict.transcript, correctAnswer: nil,
      feedback: verdict.feedback)
    result.score = verdict.score
    result.heard = verdict.heard

    if case .spokenAnswer(let content, _) = state?.steps[stepId]?.content, !verdict.isCorrect {
      result.correctAnswer = content.targetText
    }

    state?.resolve(stepId, result: result)
    sendHeldAnswers()
  }

  /// Each screen sends its held answers oldest first, so a miss lands before its retry, and stops at
  /// its first failure. Screens send at once, a screen already sending goes on to what was held
  /// since, and each save sends the screens that stopped again.
  func sendHeldAnswers() {
    for stepId in Set(held.map(\.stepId)) where saving[stepId] == nil {
      saving[stepId] = Task {
        while let next = held.first(where: { $0.stepId == stepId }), await record(next) {
          sendHeldAnswers()
        }

        saving[stepId] = nil
      }
    }
  }

  private func heldAnswersSent() async {
    while let sending = saving.values.first {
      await sending.value
    }
  }

  private func hold(_ answer: HeldAnswer) {
    held.append(answer)
    heldOnDevice?.keep(answer)
  }

  /// Kept when the send fails, a 401 included; let go once the server has it or refuses it for good
  /// (the run ended, the answer doesn't fit the screen).
  private func record(_ answer: HeldAnswer) async -> Bool {
    let api = api
    let recorded = await write { token in
      try await api.checkStep(
        stepId: answer.stepId, answer: answer.answer, attemptId: answer.attemptId,
        durationMs: answer.durationMs, runId: answer.runId, usedHelp: answer.usedHelp,
        token: token)
    }

    switch recorded {
    case .done(.checked(let verdict)):
      release(answer)
      state?.confirm(
        answer.stepId, attemptId: answer.attemptId, answer: answer.answer, verdict: verdict)
      return true
    case .done(.refused):
      release(answer)
      return true
    case .done(.failed), .failed, .obsolete:
      sendFailed = true
      return false
    }
  }

  private func release(_ answer: HeldAnswer) {
    held.removeAll { $0.attemptId == answer.attemptId }
    heldOnDevice?.drop(answer)

    if held.isEmpty {
      sendFailed = false
    }
  }

  /// Only on the learner's tap: it may run AI.
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

  private func finishIfCompleted() {
    guard state?.completion?.status == .saving else { return }
    Task { await saveCompletion() }
  }

  func finish() async {
    state?.completionSaving()
    await saveCompletion()
  }

  private func saveCompletion() async {
    guard await ensureRun() else { return }
    let identity = identity

    guard let runId = state?.runId, let token = identity?.bearerToken else {
      state?.completionFailed()
      return
    }

    // Every answer reaches the server before the run is finished, other windows' included. This
    // window's answers keep the order they were given, so a clock set back can't send a retry
    // before its miss; only another window's answers are placed by time.
    let othersHeld = (heldOnDevice?.read() ?? [])
      .filter { kept in !held.contains { $0.attemptId == kept.attemptId } }
      .sorted { $0.answeredAt < $1.answeredAt }

    for other in othersHeld {
      let later = held.firstIndex { $0.stepId == other.stepId && $0.answeredAt > other.answeredAt }
      held.insert(other, at: later ?? held.endIndex)
    }

    sendHeldAnswers()
    await heldAnswersSent()
    guard isCurrent(identity) else { return }

    guard held.isEmpty else {
      state?.completionFailed()
      return
    }

    let api = api
    let lessonId = lessonId
    let studySessionId = studySessionId
    let skippedWritingStepIds = state?.skippedWritingStepIds ?? []

    let completed = await write(invalidating: [.userProgress, .learnerModel]) { token in
      try await api.completeLesson(
        id: lessonId, runId: runId, skippedWritingStepIds: skippedWritingStepIds, token: token)
    }

    switch completed {
    case .done(.completed(let summary)):
      state?.completionSaved(summary)

      if let studySessionId, let block = summary.block {
        blockFinished(studySessionId, block)
      }

      if endsAsGuest {
        fit = await api.getLessonFit(id: lessonId, token: token)
      }
    case .done(.incomplete):
      // The run is missing an answer: the server's answers say which screen to go back to, and
      // the lesson read again has any picture a left-out question was waiting for.
      async let pictures: Void = lessonResource.refresh()
      let restarted = await write { token in
        try await api.startLesson(
          id: lessonId, studySessionId: studySessionId, runId: runId, token: token)
      }
      await pictures
      guard isCurrent(identity) else { return }

      if case .done(.success(let run)) = restarted, run.runId == runId {
        let steps: [LessonStep] =
          if case .ready(let lesson) = lessonResource.value { lesson.steps } else { [] }
        state?.resync(
          answers: run.answers, optionalStepIds: run.optionalStepIds,
          lesson: steps.filter { !isUnplayable($0) })
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

  private func isCurrent(_ identity: AuthenticatedSession?) -> Bool {
    !Task.isCancelled && session.authenticatedSession == identity
  }
}

extension LessonAnswer {
  var text: String? {
    switch self {
    case .typedAnswer(let text), .spokenAnswer(let text): text
    default: nil
    }
  }
}
