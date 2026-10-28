import SwiftUI

/// "Practice mistakes": a short run over a few open mistakes (or one skill's), each drilled the way
/// its cause calls for, with the answer and why after every question. It plays like a session
/// block; a mistake answered right on a later day is fixed, and the run counts toward today as it
/// goes, stopped early included.
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

  /// The active goal scopes the notebook, its practice and test-outs.
  private var goalId: String? { summary.summary.value?.activeGoalID }

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
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { closeButton }
      }
    }
    // Practice picks a fresh set of mistakes when it opens.
    // Loads once the session (and the active goal) is known, and again if it changes: a screen
    // opened at launch can appear before the session is restored.
    .task(
      id:
        "\(session.authenticatedSession?.accountID ?? ""):\(summary.summary.value != nil):\(goalId ?? "")"
    ) {
      await read()
    }
  }

  // MARK: Run

  @ViewBuilder
  private var run: some View {
    switch state.phase {
    case .ending:
      ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
    case .ended(let summary):
      PracticeDoneView(summary: summary, fixed: state.fixedIds.count, reached: state.reached) {
        dismiss()
      }
    default:
      if let step = state.step {
        PracticeTaskLayout(segments: state.segments, index: state.index) {
          stepContent(step)
        } actions: {
          stepActions(step)
        }
      }
    }
  }

  @ViewBuilder
  private func stepContent(_ step: MistakePracticeStep) -> some View {
    let drill = step.entry.drill
    let graded: (answer: PracticeAnswer, grade: MistakePracticeGrade, timedOut: Bool)? =
      if case .feedback(let answer, let grade, let timedOut) = state.phase {
        (answer, grade, timedOut)
      } else { nil }

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
        DrillCountdownView(seconds: seconds) { Task { await check(.dontKnow, timedOut: true) } }
          .id("clock-\(state.index)")
      }

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

      if let graded {
        PracticeFeedbackPanel(
          verdict: PracticeVerdict(
            isCorrect: graded.grade.isCorrect, notSure: graded.answer.isDontKnow && !graded.timedOut
          ),
          explanation: graded.grade.explanation
        ) {
          DrillAnswerNotes(
            drill: drill, notSure: graded.answer.isDontKnow, timedOut: graded.timedOut,
            trap: graded.grade.trap)
        }
      }
    }
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
          comment: "Shows a misread drill's answers once the question was read.")
      ) { state.reveal() }
    case .feedback(_, let grade, _):
      HStack(spacing: 12) {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Continue", table: "Practice", comment: "Moves on after a grade.")
        ) {
          next()
        }
        ask(step, answered: true, missed: !grade.isCorrect)
      }
    case .answering, .checking, .answerFailed:
      if case .answerFailed(let answer, let timedOut) = state.phase {
        PracticeSaveError { Task { await check(answer, timedOut: timedOut) } }
      }

      HStack(spacing: 12) {
        PracticeSecondaryButton(
          title: step.entry.drill.kind == .noGuessing
            ? LocalizedStringResource(
              "I'm not sure", table: "Practice",
              comment: "Honest way out of a guess in a no-guessing drill.")
            : LocalizedStringResource(
              "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."
            ),
          systemImage: "questionmark.circle",
          isDisabled: !state.acceptsAnswer
        ) { Task { await check(.dontKnow, timedOut: false) } }

        PracticeMainButton(
          title: LocalizedStringResource(
            "Check", table: "Practice", comment: "Sends the answer to be graded."),
          isBusy: { if case .checking = state.phase { true } else { false } }(),
          isDisabled: !state.acceptsAnswer || draft == nil
        ) {
          if let draft { Task { await check(draft, timedOut: false) } }
        }

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

  /// Ends the run early: what was answered counts. Before any answer, and once it's over,
  /// there's nothing to count, so it just leaves.
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
      .disabled({ if case .checking = state.phase { true } else { false } }())
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
      .buttonStyle(.bordered)
    }
  }

  // MARK: Requests

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

  /// Each answer comes with the run's earlier answers, so saving it counts the run so far. Its
  /// attempt id is kept for the question, so sending it again after a failure is recorded once.
  private func check(_ answer: PracticeAnswer, timedOut: Bool) async {
    guard let step = state.step, state.acceptsAnswer, let identity = session.authenticatedSession
    else { return }

    let limitMs = (step.entry.drill.timeLimitSeconds ?? 0) * 1000
    let durationMs = Int(Date.now.timeIntervalSince(shownAt) * 1000)
    state.check(answer, timedOut: timedOut)

    if attempt?.index != state.index {
      attempt = (UUID().uuidString.lowercased(), state.index)
    }

    do {
      let grade = try await practice.api.answerMistake(
        token: identity.bearerToken, mistakeId: step.entry.mistakeId, itemId: step.question.itemId,
        answer: answer, durationMs: timedOut ? max(durationMs, limitMs) : durationMs,
        attemptId: attempt?.id ?? UUID().uuidString.lowercased(), runAnswerIds: state.answerIds,
        goalId: goalId)
      state.answered(grade, mistakeId: step.entry.mistakeId)
      practice.changed(.answered)
    } catch {
      if case APIError.unauthorized = error { await session.expire(identity) }
      state.answerFailed()
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

  /// Counts the whole run once more at its end; a count that didn't get through still ends it,
  /// since each answer was counted as it came.
  private func finish() async {
    guard !state.answerIds.isEmpty, let identity = session.authenticatedSession else {
      state.ended(nil)
      return
    }

    let summary = try? await practice.api.finishMistakePractice(
      token: identity.bearerToken, answerIds: state.answerIds, ended: true, goalId: goalId)
    state.ended(summary)
    practice.changed(.finished)
  }
}

/// The end of a run: "Practice done", its right answers and Brain Power, the mistakes it fixed,
/// what the whole run reached, and back to the notebook. A run with a miss says the rest come
/// back, so a hard day reads as "not yet".
private struct PracticeDoneView: View {
  let summary: Components.Schemas.MistakePracticeCompletion?
  let fixed: Int
  let reached: PracticeReached
  let close: () -> Void
  @Environment(\.practiceHooks) private var hooks
  @State private var ceremonyClosed = false

  var body: some View {
    if let milestone = summary?.ceremony, !ceremonyClosed, let ceremony = hooks.ceremony {
      ceremony(milestone.value1) { ceremonyClosed = true }
    } else {
      PracticeTaskLayout {
        PracticeResultHeader(
          title: LocalizedStringResource(
            "Practice done", table: "Practice", comment: "End of a practice run."),
          detail: comesBack
            ? LocalizedStringResource(
              "The rest come back another day, when they stick better.", table: "Practice",
              comment: "End of a mistakes practice run with a miss.") : nil,
          correct: summary?.correct, total: summary?.total, brainPower: summary?.brainPower ?? 0,
          facts: fixed > 0
            ? [
              String(
                localized: "\(fixed) mistakes fixed", table: "Practice",
                comment: "How many mistakes a run fixed.")
            ] : [],
          reached: reached)
      } actions: {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Back", table: "Practice", comment: "Leaves a finished run."), action: close)
      }
    }
  }

  private var comesBack: Bool {
    guard let summary else { return fixed == 0 }
    return summary.correct < summary.total
  }
}
