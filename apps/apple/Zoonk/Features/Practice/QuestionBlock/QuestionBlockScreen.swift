import SwiftUI

/// Opened on its own, without `onFinished`, it shows a short result and closes.
struct QuestionBlockScreen: View {
  let sessionId: String
  let blockId: String
  var onFinished: ((Components.Schemas.StudyBlockCompletion) -> Void)?
  var onStop: (() async -> Bool)?

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.dismiss) private var dismiss
  @State private var load: PracticeLoad<QuestionBlockRun> = .loading

  init(
    sessionId: String, blockId: String,
    onFinished: ((Components.Schemas.StudyBlockCompletion) -> Void)? = nil,
    onStop: (() async -> Bool)? = nil
  ) {
    self.sessionId = sessionId
    self.blockId = blockId
    self.onFinished = onFinished
    self.onStop = onStop
  }

  var body: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let run):
          QuestionBlockView(
            run: run, sessionId: sessionId, onFinished: onFinished, onStop: onStop,
            onRefresh: { Task { await read() } })
        }
      }
      .taskClose {
        PracticeCloseButton { dismiss() }
      }
      .navigationBarTitleDisplayMode(.inline)
    }
    .task(id: session.authenticatedSession) { await read() }
  }

  /// Reads the block; a block not started yet starts first, since the learner's tap opened it.
  private func read() async {
    guard let identity = session.authenticatedSession else { return }

    do {
      var detail = try await practice.api.studyBlock(
        token: identity.bearerToken, sessionId: sessionId, blockId: blockId)

      if detail.block.status == .pending {
        let (sessionId, blockId) = (sessionId, blockId)
        switch await practice.write(
          .answered,
          { identity in
            try await practice.api.startStudyBlock(
              token: identity.bearerToken, sessionId: sessionId, blockId: blockId)
          })
        {
        case .done: break
        case .refused, .failed:
          load = .failed(.unavailable)
          return
        case .obsolete: return
        }

        detail = try await practice.api.studyBlock(
          token: identity.bearerToken, sessionId: sessionId, blockId: blockId)
      }

      guard session.authenticatedSession == identity else { return }

      load = .loaded(
        QuestionBlockRun(
          detail: detail,
          client: LiveQuestionBlockClient(
            practice: practice, sessionId: sessionId, blockId: blockId))
      )
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }
}

struct QuestionBlockView: View {
  @Bindable var run: QuestionBlockRun
  let sessionId: String
  var onFinished: ((Components.Schemas.StudyBlockCompletion) -> Void)?
  var onStop: (() async -> Bool)?
  var onRefresh: () -> Void

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(\.dismiss) private var dismiss
  @State private var stopFailed = false
  @State private var isStopping = false

  var body: some View {
    let phase = run.state.phase

    Group {
      if case .finished(let completion) = phase {
        BlockFinishedView(kind: run.detail.block.kind, completion: completion) { dismiss() }
      } else {
        PracticeTaskLayout(segments: run.state.segments, index: run.state.index) {
          stimulus(phase: phase)
        } response: {
          response(phase: phase)
        } actions: {
          actions(phase: phase)
        }
      }
    }
    .navigationTitle(Text(blockTitle))
    .onChange(of: phase) { _, phase in
      if case .finished(let completion) = phase {
        onFinished?(completion)
      }
    }
    .onChange(of: run.needsRefresh) { _, needsRefresh in
      if needsRefresh { onRefresh() }
    }
  }

  @ViewBuilder
  private func stimulus(phase: QuestionBlockPhase) -> some View {
    if phase == .finishReady {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Every question is answered", tableName: "Practice",
          comment: "Title of a block opened again with every answer in."
        )
        .font(.title2.bold())
        Text(
          "Finish to see how it went.", tableName: "Practice",
          comment: "Under the title of a block opened again with every answer in."
        )
        .foregroundStyle(.secondary)
      }
    } else if phase == .finishing {
      ProgressView().frame(maxWidth: .infinity)
    } else if let question = run.question {
      if run.detail.isNetScored(question) {
        NetScoreLine(tally: run.state.netTally)
      }

      if let drill = run.drill, run.drillStage == .idea, let lesson = drill.lesson {
        DrillIdeaView(drill: drill, lesson: lesson)
      } else {
        let graded = graded(phase)

        if let machine = question.timeMachine, graded == nil {
          PracticeCallout(systemImage: "clock.arrow.circlepath") {
            Text(
              TimeMachineText.line(
                machine, result: nil, format: question.format, labels: run.detail.trueFalseLabels))
          }
        }

        if let drill = run.drill, !drill.isIdeaFirst, run.isFirstOfDrill || drill.isReadFirst {
          DrillNoteView(drill: drill, isAnswered: graded != nil)
        }

        if let seconds = run.drill?.timeLimitSeconds, phase == .answering {
          DrillCountdownView(seconds: seconds, start: run.shownAt) { Task { await run.timeUp() } }
            .id("clock-\(question.id)")
        }

        asked(question, phase: phase).stimulus
      }
    }
  }

  @ViewBuilder
  private func response(phase: QuestionBlockPhase) -> some View {
    if phase != .finishReady, phase != .finishing, let question = run.question,
      run.drillStage != .idea || run.drill?.lesson == nil
    {
      asked(question, phase: phase).response

      if let graded = graded(phase) {
        feedback(graded.feedback, answer: graded.answer, question: question)
      }
    }
  }

  private func graded(_ phase: QuestionBlockPhase) -> (
    answer: PracticeAnswer, feedback: PracticeFeedback
  )? {
    if case .feedback(let answer, let feedback) = phase { (answer, feedback) } else { nil }
  }

  private func asked(_ question: PracticeQuestion, phase: QuestionBlockPhase)
    -> PracticeQuestionView
  {
    let result = graded(phase).map {
      PracticeItemResult(
        answer: $0.answer, correctAnswer: $0.feedback.correctAnswer,
        isCorrect: $0.feedback.isCorrect)
    }

    return PracticeQuestionView(
      question: question,
      labels: run.detail.trueFalseLabels,
      allowsBlank: run.detail.isNetScored(question),
      result: result,
      isLocked: !phase.acceptsAnswer,
      continuesSet: run.detail.continuesSet(at: run.state.index),
      hidesAnswers: run.drillStage == .reading,
      askedIn: run.detail.block.id,
      recordingQuestions: run.detail.recordingQuestions(for: question),
      transcript: graded(phase)?.feedback.transcript,
      draft: $run.draft,
      onSubmit: { answer in Task { await run.submit(answer) } })
  }

  private func feedback(
    _ feedback: PracticeFeedback, answer: PracticeAnswer, question: PracticeQuestion
  ) -> some View {
    let verdict = PracticeVerdict(
      isCorrect: feedback.isCorrect, blank: feedback.blank,
      notSure: answer.isDontKnow && !run.timedOut)
    let mark: AnswerOptionResult = feedback.isCorrect ? .right : .wrong

    return VStack(alignment: .leading, spacing: 12) {
      PracticeFeedbackPanel(
        verdict: verdict,
        streak: feedback.isCorrect ? feedback.hyperdrive.streak : 0,
        correctAnswerText: PracticeAnswerText.correctLine(
          feedbackIsCorrect: feedback.isCorrect, correctAnswer: feedback.correctAnswer,
          question: question,
          labels: run.detail.trueFalseLabels),
        explanation: feedback.explanation,
        workedSteps: feedback.isCorrect ? [] : feedback.workedSteps,
        citation: question.citation
      ) {
        DrillAnswerNotes(
          drill: run.drill, notSure: answer.isDontKnow, timedOut: run.timedOut, trap: feedback.trap)

        if let machine = question.timeMachine {
          QuestionNote(systemImage: "clock.arrow.circlepath") {
            Text(
              TimeMachineText.line(
                machine, result: mark, format: question.format, labels: run.detail.trueFalseLabels))
          }
        }

        MistakeMovedNote(feedback: feedback)
      }

      if feedback.pauseSuggested {
        PauseSuggestionView(isStopping: isStopping, failed: stopFailed) { Task { await stop() } }
      }
    }
  }

  @ViewBuilder
  private func actions(phase: QuestionBlockPhase) -> some View {
    switch phase {
    case .alreadyAnswered:
      Text(
        "You already answered this question.", tableName: "Practice",
        comment: "Shown when an answer was saved before."
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
      PracticeMainButton(title: continueTitle) { onRefresh() }
    case .finishReady:
      PracticeMainButton(title: finishTitle) { Task { await run.finish() } }
    case .finishFailed:
      PracticeSaveError { Task { await run.finish() } }
    case .finishing, .finished:
      EmptyView()
    case .feedback(_, let feedback):
      HStack(spacing: 12) {
        PracticeMainButton(title: continueTitle) { Task { await run.next() } }
        ask(answered: true, missed: !feedback.isCorrect)
      }
    case .answering, .checking, .answerFailed:
      if phase == .answerFailed {
        PracticeSaveError { Task { await run.retryAnswer() } }
      }

      if run.drillStage == .idea {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Start the questions", table: "Practice",
            comment: "Starts a content-gap drill's questions after its idea.")
        ) { run.startDrill() }
      } else if run.drillStage == .reading {
        PracticeMainButton(
          title: LocalizedStringResource(
            "I've read it. Show the answers", table: "Practice",
            comment: "Shows a misread drill's answers once the question was read.")
        ) { run.revealAnswers() }
      } else {
        answerButtons(phase: phase)
      }
    }
  }

  @ViewBuilder
  private func answerButtons(phase: QuestionBlockPhase) -> some View {
    let question = run.question
    let accepts = phase.acceptsAnswer

    PracticeActionRow {
      if run.drill?.kind == .noGuessing, accepts {
        PracticeSecondaryButton(
          title: LocalizedStringResource(
            "I'm not sure", table: "Practice",
            comment: "Honest way out of a guess in a no-guessing drill."),
          systemImage: "questionmark.circle"
        ) { Task { await run.submit(.dontKnow) } }
      } else if question?.placement == true || question?.format == .typed, accepts {
        PracticeSecondaryButton(
          title: LocalizedStringResource(
            "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."),
          systemImage: "questionmark.circle"
        ) { Task { await run.submit(.dontKnow) } }
      }

      PracticeMainButton(
        title: LocalizedStringResource(
          "Check", table: "Practice", comment: "Sends the answer to be graded."),
        isBusy: phase == .checking,
        isDisabled: !accepts || run.draft?.complete == nil
      ) {
        if let answer = run.draft?.complete { Task { await run.submit(answer) } }
      }

      ask(answered: false, missed: false)
    }
  }

  @ViewBuilder
  private func ask(answered: Bool, missed: Bool) -> some View {
    if let askButton = hooks.askButton, let question = run.question {
      askButton(
        PracticeAskTarget(
          itemId: question.itemId, question: question.question, blockId: run.detail.block.id,
          answered: answered, missed: missed))
    }
  }

  private var continueTitle: LocalizedStringResource {
    LocalizedStringResource("Continue", table: "Practice", comment: "Moves on after a grade.")
  }

  private var finishTitle: LocalizedStringResource {
    LocalizedStringResource(
      "Finish", table: "Practice", comment: "Finishes a block opened with every answer in.")
  }

  private var blockTitle: LocalizedStringResource {
    PracticeBlockTitle.title(for: run.detail.block)
  }

  private func stop() async {
    isStopping = true
    stopFailed = false
    defer { isStopping = false }

    if let onStop {
      stopFailed = !(await onStop())
      return
    }

    let sessionId = sessionId
    switch await practice.write(
      .finished,
      { identity in
        try await practice.api.stopSession(token: identity.bearerToken, sessionId: sessionId)
      })
    {
    case .done: dismiss()
    case .refused, .failed: stopFailed = true
    case .obsolete: break
    }
  }
}

private struct NetScoreLine: View {
  let tally: NetTally

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(
        [
          tally.right == 0
            ? String(
              localized: "0 right", table: "Practice",
              comment: "A net-scored block with no right answers yet.")
            : String(
              localized: "\(tally.right) right", table: "Practice",
              comment: "A net-scored block's right answers so far."),
          tally.wrong == 0
            ? String(
              localized: "0 wrong", table: "Practice",
              comment: "A net-scored block with no wrong answers yet.")
            : String(
              localized: "\(tally.wrong) wrong", table: "Practice",
              comment: "A net-scored block's wrong answers so far."),
          String(
            localized: "net \(tally.net)", table: "Practice",
            comment: "A net-scored block's score: right answers minus wrong ones."),
        ]
        .joined(separator: " · ")
      )
      .font(.footnote.monospacedDigit())
      .foregroundStyle(.secondary)

      Text(
        "A wrong answer cancels a right one. Not sure? Leave it blank.", tableName: "Practice",
        comment: "Why a net-scored block offers 'Leave blank'."
      )
      .font(.caption)
      .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct MistakeMovedNote: View {
  let feedback: PracticeFeedback

  var body: some View {
    if feedback.mistakeFixed {
      QuestionNote(systemImage: "checkmark.circle") {
        Text(
          "Mistake fixed. It leaves your notebook.", tableName: "Practice",
          comment: "After answering a saved mistake right.")
      }
    } else if feedback.savedToNotebook {
      QuestionNote(systemImage: "square.and.pencil") {
        Text(
          "Saved to your mistakes · it comes back tomorrow", tableName: "Practice",
          comment: "After a wrong answer saved to the mistakes notebook.")
      }
    }
  }
}

/// A short break usually helps more than pushing on. Stopping keeps everything done so far.
private struct PauseSuggestionView: View {
  let isStopping: Bool
  let failed: Bool
  let stop: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      PracticeCallout(systemImage: "cup.and.saucer") {
        Text(
          "A few misses in a row. A short break often helps, and everything you did today counts.",
          tableName: "Practice", comment: "Suggests a break after accuracy dropped.")
      }

      Button(action: stop) {
        Text(
          "Stop for today", tableName: "Practice",
          comment: "Stops today's session from the pause suggestion.")
      }
      .buttonStyle(.bordered)
      .disabled(isStopping)

      if failed {
        Text(
          "We couldn't stop the session. Try again.", tableName: "Practice",
          comment: "Stopping the session failed."
        )
        .font(.subheadline)
        .foregroundStyle(.destructive)
      }
    }
  }
}

private struct BlockFinishedView: View {
  let kind: PracticeBlock.Kind
  let completion: Components.Schemas.StudyBlockCompletion
  let close: () -> Void

  var body: some View {
    PracticeTaskLayout {
      PracticeResultHeader(
        title: title, correct: completion.correct, total: completion.total,
        brainPower: completion.brainPower,
        reached: PracticeReached(
          energy: completion.reached.energy,
          level: completion.reached.level.map { .init(color: $0.color.rawValue, level: $0.level) }))
    } actions: {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Continue", table: "Practice", comment: "Moves on after a grade."), action: close)
    }
  }

  private var title: LocalizedStringResource {
    switch kind {
    case .learn:
      LocalizedStringResource(
        "Lesson complete", table: "Practice", comment: "End of a lesson block.")
    case .review:
      LocalizedStringResource("Review done", table: "Practice", comment: "End of a review block.")
    default:
      LocalizedStringResource("Practice done", table: "Practice", comment: "End of a practice run.")
    }
  }
}

enum PracticeBlockTitle {
  static func title(for block: PracticeBlock) -> LocalizedStringResource {
    if let checkpoint = block.checkpoint {
      switch checkpoint.kind {
      case .weekly:
        return checkpoint.mock
          ? LocalizedStringResource(
            "Mock exam", table: "Practice", comment: "Title of a weekly mock exam block.")
          : LocalizedStringResource(
            "Weekly challenge", table: "Practice", comment: "Title of the weekly challenge block.")
      case .finalBoss:
        return LocalizedStringResource(
          "Final challenge", table: "Practice", comment: "Title of the final challenge block.")
      case .boss:
        return checkpoint.rematch
          ? LocalizedStringResource(
            "Challenge, second try", table: "Practice",
            comment: "Title of a lost phase challenge's rematch.")
          : LocalizedStringResource(
            "Phase challenge", table: "Practice", comment: "Title of a phase challenge block.")
      }
    }

    switch block.kind {
    case .review where block.capsules.isEmpty:
      return LocalizedStringResource(
        "What you already know", table: "Practice",
        comment: "Title of the first week's placement questions block.")
    case .review:
      return block.estimatedMinutes > 5
        ? LocalizedStringResource(
          "Reviews", table: "Practice", comment: "Title of a long review block.")
        : LocalizedStringResource(
          "Quick review", table: "Practice", comment: "Title of a short review block.")
    case .learn:
      return block.title.map { LocalizedStringResource(stringLiteral: $0) }
        ?? LocalizedStringResource(
          "New lesson", table: "Practice", comment: "Title of a lesson block without a title yet.")
    case .produce:
      return block.title.map { LocalizedStringResource(stringLiteral: $0) }
        ?? LocalizedStringResource(
          "Writing practice", table: "Practice", comment: "Title of a writing block.")
    case .practice, .checkpoint:
      if block.fullReview {
        return LocalizedStringResource(
          "Full review", table: "Practice", comment: "Title of a full review block.")
      }
      if block.mistakesOnly {
        return LocalizedStringResource(
          "Practice mistakes", table: "Practice",
          comment: "Title of a block that only fixes mistakes.")
      }
      return block.extra
        ? LocalizedStringResource(
          "Bonus practice", table: "Practice", comment: "Title of an extra practice block.")
        : LocalizedStringResource(
          "Mixed practice", table: "Practice", comment: "Title of a mixed practice block.")
    }
  }
}
