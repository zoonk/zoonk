import SwiftUI

/// A mistake answered right on a later day is fixed, and the run counts toward today as it goes,
/// stopped early included. A day block's run completes its block once its mistakes are served.
struct MistakePracticeScreen: View {
  let scope: MistakePracticeScope

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(LearnerSummaryStore.self) private var summary
  @Environment(\.dismiss) private var dismiss
  @State private var load: PracticeLoad<MistakePracticeSet> = .loading
  @State private var state = MistakePracticeState(entries: [])
  @State private var draft: PracticeAnswer?
  @State private var labels = PracticeTrueFalseLabels.trueFalse
  @State private var shownAt = Date.now
  @State private var attempt: (id: String, index: Int)?
  @State private var showsSaveReport = false
  /// A day block's completion that didn't get through: the run waits on it, with a retry.
  @State private var finishFailures = 0
  @State private var isFinishing = false
  /// "Practice again" reading the next batch; its outcome is the read's failure.
  @State private var again = VisitRequest<APIError>()
  @FocusState private var focus: PracticeFocus?
  @AccessibilityFocusState private var voiceOverFocus: PracticeFocus?
  @State private var pressedWithFocus: PracticeFocus?

  private var goalId: String? { summary.summary.value?.activeGoalID }

  private var focuses: PracticeFocusState {
    PracticeFocusState(keyboard: $focus, voiceOver: $voiceOverFocus)
  }

  init(scope: MistakePracticeScope = .notebook) {
    self.scope = scope
  }

  var body: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let set) where set.entries.isEmpty && state.phase != .ending:
          if scope.blockId == nil { nothingToPractice } else { alreadyFixed }
        case .loaded:
          run
        }
      }
      .navigationTitle(
        Text(
          "Practice mistakes", tableName: "Practice", comment: "Title of the mistakes practice run."
        )
      )
      .navigationBarTitleDisplayMode(.inline)
      .taskClose { closeButton }
      .questionOptions(reportTarget)
    }
    .task(
      id:
        "\(session.authenticatedSession?.bearerToken ?? ""):\(summary.summary.value != nil):\(goalId ?? "")"
    ) {
      await read()
    }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "mistake-practice", reportType: .saveFailure), isReport: true
    )
    .onDisappear { again.leave() }
  }

  /// Main's `QuestionMenu`: the question or lesson screen in view, once answered on a timed drill.
  private var reportTarget: FeedbackContext? {
    guard case .loaded = load, let step = state.step else { return nil }

    switch state.phase {
    case .feedback, .lessonFeedback:
      break
    case .answering, .checking, .answerFailed, .lessonChecking:
      if step.entry.drill.timeLimitSeconds != nil { return nil }
    case .idea, .ending, .ended:
      return nil
    }

    if let lesson = step.entry.lesson {
      return FeedbackContext(
        contentID: lesson.step.id, contentKind: .step, screen: "mistake-practice")
    }

    return step.question.map {
      FeedbackContext(contentID: $0.itemId, contentKind: .item, screen: "mistake-practice")
    }
  }

  @ViewBuilder
  private var run: some View {
    switch state.phase {
    case .ending where finishFailures > 0 && !isFinishing:
      PracticeTaskLayout(isResult: true) {
        unsavedEnd
      } actions: {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Try again", table: "Practice", comment: "Sends an answer that didn't save again.")
        ) {
          Task { await finish() }
        }
      }
    case .ending:
      ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
    case .ended(let summary):
      PracticeDoneView(
        summary: summary, answered: state.answerIds.count, right: state.rightAnswers,
        fixed: state.fixedIds.count, reached: state.reached, inDay: scope.blockId != nil,
        canPracticeAgain: scope.offersPracticeAgain(hasMorePractice: summary?.hasMorePractice),
        isLoadingAgain: again.isRunning, againFailed: again.outcome != nil,
        again: practiceAgain
      ) {
        dismiss()
      }
      .completionMoments(
        certificates: summary?.certificates ?? [], ceremony: summary?.ceremony?.value1)
    default:
      if let step = state.step {
        if let lesson = step.entry.lesson {
          MistakeLessonQuestionView(
            replay: lesson, entry: step.entry, segments: state.segments, index: state.index,
            goalId: goalId, scope: scope, answerIds: state.answerIds,
            checking: { state.checkingLesson() }, failed: { state.lessonFailed() },
            answered: { state.answeredLesson($0, mistakeId: step.entry.mistakeId) },
            next: next
          )
          .id(state.index)
          .environment(\.practiceFocus, focuses)
        } else {
          PracticeTaskLayout(segments: state.segments, index: state.index) {
            stepStimulus(step)
          } response: {
            stepResponse(step)
          } actions: {
            stepActions(step)
          }
          .announcesStatus(feedback)
          .environment(\.practiceFocus, focuses)
          .onChange(of: state.phase) { _, phase in followPress(to: phase) }
        }
      }
    }
  }

  @ViewBuilder
  private func stepStimulus(_ step: MistakePracticeStep) -> some View {
    let drill = step.entry.drill

    if state.phase == .idea, let lesson = drill.lesson {
      DrillIdeaView(drill: drill, lesson: lesson)
    } else {
      if step.isFirstOfEntry && !drill.isIdeaFirst {
        DrillNoteView(drill: drill, isAnswered: graded != nil)
      }

      if let seconds = drill.timeLimitSeconds, state.phase == .answering {
        DrillCountdownView(seconds: seconds, start: shownAt) {
          Task { await check(.dontKnow, by: .timer) }
        }
        .id("clock-\(state.index)")
      }

      if let question = step.question { asked(question, step: step).stimulus }
    }
  }

  @ViewBuilder
  private func stepResponse(_ step: MistakePracticeStep) -> some View {
    let drill = step.entry.drill

    if state.phase != .idea || drill.lesson == nil {
      if let question = step.question { asked(question, step: step).response }

      if let graded {
        PracticeFeedbackPanel(
          verdict: PracticeVerdict(
            isCorrect: graded.grade.isCorrect,
            notSure: graded.answer.isDontKnow && graded.sender != .timer
          ),
          misses: step.question.flatMap {
            PracticeAnswerText.misses(for: graded.answer, question: $0)
          },
          explanation: graded.grade.explanation,
          workedSteps: graded.grade.isCorrect ? [] : graded.grade.workedSteps
        ) {
          DrillAnswerNotes(
            drill: drill, notSure: graded.answer.isDontKnow, timedOut: graded.sender == .timer,
            trap: graded.grade.trap)

          FixedMistakesNote(grade: graded.grade)
        }
      }
    }
  }

  private var feedback: String? {
    guard let graded else {
      return nil
    }

    let verdict = PracticeVerdict(
      isCorrect: graded.grade.isCorrect,
      notSure: graded.answer.isDontKnow && graded.sender != .timer)

    let lead: [String?] = [
      graded.sender == .timer ? DrillAnswerNotes.timesUp : nil, String(localized: verdict.label),
    ]
    let misses = state.step?.question.flatMap {
      PracticeAnswerText.misses(for: graded.answer, question: $0)?.said
    }

    return (lead + [misses, graded.grade.explanation]).compactMap(\.self).joinedSentences()
  }

  private var graded: (answer: PracticeAnswer, grade: MistakePracticeGrade, sender: AnswerSender)? {
    if case .feedback(let answer, let grade, let sender) = state.phase {
      (answer, grade, sender)
    } else {
      nil
    }
  }

  private var checking: AnswerSender? {
    if case .checking(let sent) = state.phase { sent.sender } else { nil }
  }

  private func asked(_ question: PracticeQuestion, step: MistakePracticeStep)
    -> PracticeQuestionView
  {
    PracticeQuestionView(
      question: question,
      labels: labels,
      result: graded.map {
        PracticeItemResult(
          answer: $0.answer, correctAnswer: $0.grade.correctAnswer, isCorrect: $0.grade.isCorrect)
      },
      isLocked: !state.acceptsAnswer,
      askedIn: "mistake:\(step.entry.mistakeId)",
      draft: $draft,
      onSubmit: { answer in
        // The board's last pair sent it, so focus goes on to Continue as after Check.
        if question.checksEachPair {
          pressedWithFocus = .answer
        }
        Task { await check(answer, by: .check) }
      })
  }

  @ViewBuilder
  private func stepActions(_ step: MistakePracticeStep) -> some View {
    switch state.phase {
    case .idea:
      PracticeMainButton(
        title: LocalizedStringResource(
          "Start the questions", table: "Practice",
          comment: "Starts a content-gap drill's questions after its idea.")
      ) {
        shownAt = .now
        state.start()
      }
    case .feedback:
      PracticeActionRow {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Continue", table: "Practice", comment: "Moves on after a grade.")
        ) {
          next()
        }
        .practiceFocus(.next)
        ask(step, answered: true)
      }
    case .answering, .checking, .answerFailed:
      let answer = step.question?.answerToSubmit(draft)
      if case .answerFailed(let sent) = state.phase {
        PracticeSaveError(
          failures: state.saveFailures, onReport: { showsSaveReport = true },
          retry: { Task { await send(sent) } })
      }

      PracticeActionRow {
        QuestionDontKnowButton(
          title: step.entry.drill.kind == .noGuessing
            ? LocalizedStringResource(
              "I'm not sure", table: "Practice",
              comment: "Honest way out of a guess in a no-guessing drill.")
            : LocalizedStringResource(
              "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."
            ),
          isBusy: checking == .notSure,
          isDisabled: !state.acceptsAnswer
        ) {
          press(.notSure)
          Task { await check(.dontKnow, by: .notSure) }
        }
        .practiceFocus(.notSure)

        // A learning match sends itself with its last pair, so its main action waits as Continue.
        if step.question?.checksEachPair == true {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Continue", table: "Practice", comment: "Moves on after a grade."),
            isBusy: checking != nil, isDisabled: true, action: {})
        } else {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Check", table: "Practice", comment: "Sends the answer to be graded."),
            isBusy: checking?.pressesCheck == true,
            isDisabled: !state.acceptsAnswer || answer == nil
          ) {
            if let answer {
              press(.check)
              Task { await check(answer, by: .check) }
            }
          }
          .practiceFocus(.check)
        }

        ask(step, answered: false)
      }
    case .ending, .ended, .lessonChecking, .lessonFeedback:
      EmptyView()
    }
  }

  @ViewBuilder
  private func ask(_ step: MistakePracticeStep, answered: Bool) -> some View {
    if step.entry.tutorAvailable, let question = step.question, let askButton = hooks.askButton {
      askButton(
        PracticeAskTarget(
          itemId: question.itemId, question: question.question, blockId: nil,
          answered: answered, mistakeId: step.entry.mistakeId))
    }
  }

  /// Before any answer, and once it's over, there's nothing to count, so it just leaves.
  @ViewBuilder
  private var closeButton: some View {
    if state.answerIds.isEmpty || state.isOver {
      PracticeCloseButton(
        label: LocalizedStringResource(
          "Leave", table: "Practice",
          comment: "VoiceOver label: leaves mistake practice.")
      ) { leave() }
    } else {
      PracticeCloseButton(
        label: LocalizedStringResource(
          "Leave. What you answered counts.", table: "Practice",
          comment: "VoiceOver label: ends mistake practice early.")
      ) { Task { await end() } }
      .disabled(checking != nil || state.phase == .lessonChecking)
    }
  }

  /// A day's step is left for Today, not on into the day, which its own Continue does.
  private func leave() {
    if scope.blockId == nil {
      dismiss()
    } else {
      hooks.navigate(.today)
    }
  }

  /// A day's block whose mistakes were fixed elsewhere, once its completion got through: it goes on
  /// into the day like any finished step.
  private var alreadyFixed: some View {
    PracticeTaskLayout(isResult: true) {
      PracticeResultTitle(title: Self.alreadyFixedTitle, detail: nil)
    } actions: {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Done", table: "Practice", comment: "Leaves a finished screen.")
      ) {
        dismiss()
      }
    }
  }

  private static let alreadyFixedTitle = LocalizedStringResource(
    "Already fixed", table: "Practice",
    comment: "A day's step of mistakes to fix, opened after they were all fixed elsewhere")

  private var nothingToPractice: some View {
    StateMessage {
      Label {
        Text(
          "Nothing to practice", tableName: "Practice",
          comment: "Title when no mistake is ready to practice.")
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } actions: {
      Button {
        dismiss()
      } label: {
        Text("Back", tableName: "Practice", comment: "Leaves an empty practice.")
      }
      .buttonStyle(.outline)
    }
    .lonePage()
  }

  /// A run's end that didn't reach the server. With nothing answered (a day block emptied
  /// elsewhere), there's nothing kept to mention.
  @ViewBuilder
  private var unsavedEnd: some View {
    if state.answerIds.isEmpty {
      PracticeResultTitle(title: Self.alreadyFixedTitle, detail: nil)
      SaveFailureNotice(
        failures: finishFailures,
        firstMessage: LocalizedStringResource(
          "We couldn't mark it done. Check your connection.", table: "Practice",
          comment: "A day's step whose mistakes were already fixed couldn't be marked done")
      ) { showsSaveReport = true }
    } else {
      PracticeResultTitle(
        title: LocalizedStringResource(
          "Your practice isn't saved yet", table: "Practice",
          comment: "Title when a run's end didn't reach the server; the learner can try again"),
        detail: nil)
      SaveFailureNotice(failures: finishFailures) { showsSaveReport = true }
    }
  }

  private func fetchSet(_ identity: AuthenticatedSession) async throws -> MistakePracticeSet {
    try await practice.api.mistakePractice(
      token: identity.bearerToken, goalId: goalId, scope: scope)
  }

  private func start(_ set: MistakePracticeSet) {
    draft = nil
    attempt = nil
    labels = set.trueFalseLabels
    state = MistakePracticeState(entries: set.entries)
    shownAt = .now
    load = .loaded(set)
  }

  private func read() async {
    // Practice is scoped to the active goal, so it waits for the summary that names it.
    guard let identity = session.authenticatedSession, summary.summary.value != nil else { return }

    do {
      let set = try await fetchSet(identity)
      guard session.authenticatedSession == identity else { return }
      start(set)
      // A block whose mistakes can no longer be asked is done once its completion gets through:
      // the day never waits on it.
      if set.entries.isEmpty, scope.blockId != nil {
        state.end()
        await finish()
      }
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  private func check(_ answer: PracticeAnswer, by sender: AnswerSender) async {
    let limitMs = (state.step?.entry.drill.timeLimitSeconds ?? 0) * 1000
    let durationMs = Int(Date.now.timeIntervalSince(shownAt) * 1000)
    await send(
      SentAnswer(
        answer: answer, sender: sender,
        measuredMs: sender == .timer ? max(durationMs, limitMs) : durationMs,
        failed: state.phase.failed))
  }

  /// Each answer comes with the run's earlier answers, so saving it counts the run so far. Its
  /// attempt id is kept for the question, so sending it again after a failure is recorded once.
  private func send(_ sent: SentAnswer) async {
    guard let step = state.step, let question = step.question, state.acceptsAnswer else { return }

    state.check(sent)

    if attempt?.index != state.index {
      attempt = (UUID().uuidString.lowercased(), state.index)
    }

    let attemptId = attempt?.id ?? UUID().uuidString.lowercased()
    let runAnswerIds = state.answerIds
    let goalId = goalId

    switch await practice.write(
      .answered,
      { identity in
        try await practice.api.answerMistake(
          token: identity.bearerToken, mistakeId: step.entry.mistakeId,
          itemId: question.itemId,
          answer: sent.answer, durationMs: sent.durationMs,
          attemptId: attemptId, runAnswerIds: runAnswerIds, goalId: goalId, scope: scope)
      })
    {
    case .done(let grade):
      state.answered(grade, mistakeId: step.entry.mistakeId)
    case .refused, .failed:
      state.answerFailed()
    case .obsolete:
      break
    }
  }

  private func press(_ control: PracticeFocus) {
    pressedWithFocus = focuses.has(control) ? control : nil
  }

  private func followPress(to phase: MistakePracticePhase) {
    guard let pressed = pressedWithFocus else { return }

    switch phase {
    case .checking:
      break
    case .answerFailed:
      focuses.move(to: pressed)
    case .feedback:
      focuses.move(to: .next)
      pressedWithFocus = nil
    default:
      pressedWithFocus = nil
    }
  }

  private func next() {
    draft = nil
    shownAt = .now
    state.next()

    if state.phase == .ending {
      Task { await finish() }
    }
  }

  private func end() async {
    state.end()
    await finish()
  }

  /// A fresh batch from the server in the same scope: a run holds at most 50, so more can be open
  /// than this one asked. The done screen stays while it loads, and says so if it doesn't.
  private func practiceAgain() {
    guard !again.isRunning, let identity = session.authenticatedSession else { return }

    again.run {
      do {
        let set = try await fetchSet(identity)
        guard session.authenticatedSession == identity, !Task.isCancelled else { return nil }
        start(set)
        return nil
      } catch let error as APIError {
        if error == .unauthorized { await session.expire(identity) }
        return error
      } catch {
        return .unavailable
      }
    }
  }

  /// A block's run always tells the server it ended, so the block completes even with nothing
  /// answered in it, and it isn't over until that gets through. Any other run's count is best
  /// effort: each answer was counted as it came.
  private func finish() async {
    guard !state.answerIds.isEmpty || scope.blockId != nil else {
      state.ended(nil)
      return
    }

    let answerIds = state.answerIds
    let goalId = goalId
    isFinishing = true
    defer { isFinishing = false }

    switch await practice.write(
      .finished,
      { identity in
        try await practice.api.finishMistakePractice(
          token: identity.bearerToken, answerIds: answerIds, goalId: goalId, scope: scope)
      })
    {
    case .done(let summary):
      finishFailures = 0
      state.ended(summary)
    case .refused, .failed:
      if scope.blockId == nil {
        state.ended(nil)
      } else {
        finishFailures += 1
      }
    case .obsolete: break
    }
  }

}

/// A run ends on what it earned, and offers to go again on what it didn't fix.
private struct PracticeDoneView: View {
  let summary: Components.Schemas.MistakePracticeCompletion?
  /// The run's own answers, known here, so every batch ends on its score.
  let answered: Int
  let right: Int
  let fixed: Int
  let reached: PracticeReached
  /// A day's step goes on into the day; any other run goes back where it came from.
  let inDay: Bool
  let canPracticeAgain: Bool
  let isLoadingAgain: Bool
  let againFailed: Bool
  let again: () -> Void
  let close: () -> Void

  var body: some View {
    PracticeTaskLayout(isResult: true) {
      PracticeResultTitle(
        title: LocalizedStringResource(
          "Practice done", table: "Practice", comment: "End of a practice run."),
        detail: nil)
      PracticeResultNumbers(
        correct: answered > 0 ? right : nil, total: answered,
        brainPower: summary?.brainPower ?? 0,
        facts: fixed > 0
          ? [
            String(
              localized: "\(fixed) mistakes fixed", table: "Practice",
              locale: .appLanguage, comment: "How many mistakes a run fixed.")
          ] : [],
        day: day)
    } actions: {
      if againFailed {
        SaveFailureNotice(failures: 1) {}
      }

      PracticeActionRow {
        if canPracticeAgain {
          PracticeSecondaryButton(
            title: LocalizedStringResource(
              "Practice again", table: "Practice",
              comment: "Starts another mistakes practice run after one ends."),
            icon: nil, isBusy: isLoadingAgain, action: again)
        }

        PracticeMainButton(
          title: inDay
            ? LocalizedStringResource(
              "Continue", table: "Practice", comment: "Moves on after a grade.")
            : LocalizedStringResource(
              "Done", table: "Practice", comment: "Leaves a finished screen."),
          action: close)
      }
    }
  }

  /// The level and Energy reached are the run's own, counted as each answer came.
  private var day: DayResult {
    let completion = summary.flatMap { DayResult($0) }
    return DayResult(
      ceremony: completion?.ceremony, certificates: completion?.certificates ?? [],
      missionMoment: completion?.missionMoment,
      reached: DayResult.Reached(
        energy: reached.energy,
        level: reached.level.map { DayResult.Reached.Level(color: $0.color, level: $0.level) }))
  }
}
