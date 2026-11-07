import SwiftUI

/// A mistake answered right on a later day is fixed, and the run counts toward today as it goes,
/// stopped early included.
struct MistakePracticeScreen: View {
  var skillId: String?

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
  @FocusState private var focus: PracticeFocus?
  @AccessibilityFocusState private var voiceOverFocus: PracticeFocus?
  @State private var pressedWithFocus: PracticeFocus?

  private var goalId: String? { summary.summary.value?.activeGoalID }

  private var focuses: PracticeFocusState {
    PracticeFocusState(keyboard: $focus, voiceOver: $voiceOverFocus)
  }

  init(skillId: String? = nil) {
    self.skillId = skillId
  }

  var body: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let set) where set.entries.isEmpty:
          nothingToPractice
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
    }
    .task(
      id:
        "\(session.authenticatedSession?.bearerToken ?? ""):\(summary.summary.value != nil):\(goalId ?? "")"
    ) {
      await read()
    }
  }

  @ViewBuilder
  private var run: some View {
    switch state.phase {
    case .ending:
      ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
    case .ended(let summary):
      PracticeDoneView(summary: summary, fixed: state.fixedIds.count, reached: state.reached) {
        dismiss()
      }
      .completionMoments(
        certificates: summary?.certificates ?? [], ceremony: summary?.ceremony?.value1)
    default:
      if let step = state.step {
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

  @ViewBuilder
  private func stepStimulus(_ step: MistakePracticeStep) -> some View {
    let drill = step.entry.drill

    if state.phase == .idea, let lesson = drill.lesson {
      DrillIdeaView(drill: drill, lesson: lesson)
    } else {
      if !drill.isIdeaFirst || !step.isFirstOfEntry {
        DrillNoteView(
          drill: drill,
          lastAnswer: step.isMistakeQuestion
            ? TrueFalseWords.savedAnswer(step.entry.snapshotAnswer, labels: labels) : nil,
          isAnswered: graded != nil)
      }

      if let seconds = drill.timeLimitSeconds, state.phase == .answering {
        DrillCountdownView(seconds: seconds, start: shownAt) {
          Task { await check(.dontKnow, by: .timer) }
        }
        .id("clock-\(state.index)")
      }

      asked(step).stimulus
    }
  }

  @ViewBuilder
  private func stepResponse(_ step: MistakePracticeStep) -> some View {
    let drill = step.entry.drill

    if state.phase != .idea || drill.lesson == nil {
      asked(step).response

      if let graded {
        PracticeFeedbackPanel(
          verdict: PracticeVerdict(
            isCorrect: graded.grade.isCorrect,
            notSure: graded.answer.isDontKnow && graded.sender != .timer
          ),
          explanation: graded.grade.explanation
        ) {
          DrillAnswerNotes(
            drill: drill, notSure: graded.answer.isDontKnow, timedOut: graded.sender == .timer,
            trap: graded.grade.trap)
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

    return [
      graded.sender == .timer ? DrillAnswerNotes.timesUp : nil, String(localized: verdict.label),
      graded.grade.explanation,
    ].compactMap(\.self).joinedSentences()
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

  private func asked(_ step: MistakePracticeStep) -> PracticeQuestionView {
    PracticeQuestionView(
      question: step.question,
      labels: labels,
      result: graded.map {
        PracticeItemResult(
          answer: $0.answer, correctAnswer: $0.grade.correctAnswer, isCorrect: $0.grade.isCorrect)
      },
      isLocked: !state.acceptsAnswer,
      hidesAnswers: state.phase == .reading,
      askedIn: "mistake:\(step.entry.mistakeId)",
      draft: $draft)
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
    case .reading:
      PracticeMainButton(
        title: LocalizedStringResource(
          "I've read it. Show the answers", table: "Practice",
          comment: "Shows a misread drill's answers once the question was read."),
        systemImage: "eye"
      ) {
        if focuses.has(.reveal) { focuses.move(to: .answer) }
        state.reveal()
      }
      .practiceFocus(.reveal)
    case .feedback(_, let grade, _):
      PracticeActionRow {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Continue", table: "Practice", comment: "Moves on after a grade.")
        ) {
          next()
        }
        .practiceFocus(.next)
        ask(step, answered: true, missed: !grade.isCorrect)
      }
    case .answering, .checking, .answerFailed:
      if case .answerFailed(let sent) = state.phase {
        PracticeSaveError { Task { await send(sent) } }
      }

      PracticeActionRow {
        PracticeSecondaryButton(
          title: step.entry.drill.kind == .noGuessing
            ? LocalizedStringResource(
              "I'm not sure", table: "Practice",
              comment: "Honest way out of a guess in a no-guessing drill.")
            : LocalizedStringResource(
              "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."
            ),
          // As on main, only "I'm not sure" carries the question mark; "I don't know yet" is words.
          systemImage: step.entry.drill.kind == .noGuessing ? "questionmark.circle" : nil,
          isBusy: checking == .notSure,
          isDisabled: !state.acceptsAnswer
        ) {
          press(.notSure)
          Task { await check(.dontKnow, by: .notSure) }
        }
        .practiceFocus(.notSure)

        PracticeMainButton(
          title: LocalizedStringResource(
            "Check", table: "Practice", comment: "Sends the answer to be graded."),
          isBusy: checking?.pressesCheck == true,
          isDisabled: !state.acceptsAnswer || draft?.complete == nil
        ) {
          if let answer = draft?.complete {
            press(.check)
            Task { await check(answer, by: .check) }
          }
        }
        .practiceFocus(.check)

        ask(step, answered: false, missed: false)
      }
    case .ending, .ended:
      EmptyView()
    }
  }

  @ViewBuilder
  private func ask(_ step: MistakePracticeStep, answered: Bool, missed: Bool) -> some View {
    if let askButton = hooks.askButton {
      askButton(
        PracticeAskTarget(
          itemId: step.question.itemId, question: step.question.question, blockId: nil,
          answered: answered, missed: missed))
    }
  }

  /// Before any answer, and once it's over, there's nothing to count, so it just leaves.
  @ViewBuilder
  private var closeButton: some View {
    if state.answerIds.isEmpty || state.isOver {
      PracticeCloseButton(
        label: LocalizedStringResource(
          "Back to the notebook", table: "Practice",
          comment: "VoiceOver label: leaves mistake practice.")
      ) { dismiss() }
    } else {
      PracticeCloseButton(
        label: LocalizedStringResource(
          "End practice. What you answered counts.", table: "Practice",
          comment: "VoiceOver label: ends mistake practice early.")
      ) { Task { await end() } }
      .disabled(checking != nil)
    }
  }

  private var nothingToPractice: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Nothing to practice yet", tableName: "Practice",
          comment: "Title when no mistake is ready to practice.")
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } description: {
      Text(
        "Mistakes come back for practice from the day after you make them.", tableName: "Practice",
        comment: "Why no mistake is ready to practice yet.")
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

  private func read() async {
    // Practice is scoped to the active goal, so it waits for the summary that names it.
    guard let identity = session.authenticatedSession, summary.summary.value != nil else { return }

    do {
      let set = try await practice.api.mistakePractice(
        token: identity.bearerToken, goalId: goalId, skillId: skillId)
      guard session.authenticatedSession == identity else { return }
      labels = set.trueFalseLabels
      state = MistakePracticeState(entries: set.entries)
      shownAt = .now
      load = .loaded(set)
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
        durationMs: sender == .timer ? max(durationMs, limitMs) : durationMs))
  }

  /// Each answer comes with the run's earlier answers, so saving it counts the run so far. Its
  /// attempt id is kept for the question, so sending it again after a failure is recorded once.
  private func send(_ sent: SentAnswer) async {
    guard let step = state.step, state.acceptsAnswer else { return }

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
          itemId: step.question.itemId,
          answer: sent.answer, durationMs: sent.durationMs,
          attemptId: attemptId, runAnswerIds: runAnswerIds, goalId: goalId)
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

  private func finish() async {
    guard !state.answerIds.isEmpty else {
      state.ended(nil)
      return
    }

    let answerIds = state.answerIds
    let goalId = goalId

    // A count that didn't get through still ends the run: each answer was counted as it came.
    switch await practice.write(
      .finished,
      { identity in
        try await practice.api.finishMistakePractice(
          token: identity.bearerToken, answerIds: answerIds, ended: true, goalId: goalId)
      })
    {
    case .done(let summary): state.ended(summary)
    case .refused, .failed: state.ended(nil)
    case .obsolete: break
    }
  }

}

/// A run with a miss says the rest come back, so a hard day reads as "not yet".
private struct PracticeDoneView: View {
  let summary: Components.Schemas.MistakePracticeCompletion?
  let fixed: Int
  let reached: PracticeReached
  let close: () -> Void

  var body: some View {
    PracticeTaskLayout(isResult: true) {
      PracticeResultTitle(
        title: LocalizedStringResource(
          "Practice done", table: "Practice", comment: "End of a practice run."),
        detail: comesBack
          ? LocalizedStringResource(
            "The rest come back another day, when they stick better.", table: "Practice",
            comment: "End of a mistakes practice run with a miss.") : nil)
      PracticeResultNumbers(
        correct: summary?.correct, total: summary?.total, brainPower: summary?.brainPower ?? 0,
        facts: fixed > 0
          ? [
            String(
              localized: "\(fixed) mistakes fixed", table: "Practice",
              comment: "How many mistakes a run fixed.")
          ] : [],
        day: day)
    } actions: {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Back", table: "Practice", comment: "Leaves a finished run."), action: close)
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

  private var comesBack: Bool {
    guard let summary else { return fixed == 0 }
    return summary.correct < summary.total
  }
}
