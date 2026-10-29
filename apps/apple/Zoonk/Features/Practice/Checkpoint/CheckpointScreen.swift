import SwiftUI

struct CheckpointScreen: View {
  let blockId: String
  var sessionId: String?

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(\.dismiss) private var dismiss
  @Environment(\.horizontalSizeClass) private var sizeClass
  @State private var load: PracticeLoad<CheckpointLoad> = .loading
  @State private var state: CheckpointDuelState?
  @State private var draft: PracticeAnswer?
  @State private var shownAt = Date.now
  @State private var showsReview = false

  init(blockId: String, sessionId: String? = nil) {
    self.blockId = blockId
    self.sessionId = sessionId
  }

  var body: some View {
    Group {
      if isCall, let checkpointCall = hooks.checkpointCall {
        // The call's screen brings its own title, close and intro.
        checkpointCall(blockId, sessionId)
      } else {
        checkpoint
      }
    }
    .task(id: session.authenticatedSession) { await read() }
  }

  /// A language phase or final checkpoint is a live call, which asks no questions.
  private var isCall: Bool {
    guard case .loaded(let loaded) = load, let state else {
      return false
    }

    return loaded.questions.isEmpty && !state.isResult
  }

  private var checkpoint: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let loaded):
          if let state {
            if isCall {
              call
            } else if loaded.checkpoint.status == .pending,
              let planItemId = loaded.checkpoint.planItemId
            {
              notStarted(planItemId: planItemId)
            } else if state.isResult {
              CheckpointResultView(load: loaded, state: state, showsReview: $showsReview) {
                dismiss()
              }
            } else {
              duel(loaded, state: state)
            }
          }
        }
      }
      .navigationTitle(Text(title))
      .navigationBarTitleDisplayMode(.inline)
      .taskClose {
        PracticeCloseButton { dismiss() }
      }
    }
  }

  private var title: LocalizedStringResource {
    guard case .loaded(let loaded) = load else {
      return LocalizedStringResource(
        "Phase challenge", table: "Practice", comment: "Title of a phase challenge block.")
    }

    return CheckpointCopy.title(loaded.checkpoint)
  }

  private var call: some View {
    ContentUnavailableView {
      Label {
        Text(title)
      } icon: {
        Image(systemName: "phone")
      }
    } description: {
      Text(
        "This challenge isn't ready yet.", tableName: "Practice",
        comment: "A challenge that can't start on this device yet.")
    }
  }

  private func notStarted(planItemId: String) -> some View {
    ContentUnavailableView {
      Label {
        Text(title)
      } icon: {
        Image(systemName: "shield.lefthalf.filled")
      }
    } actions: {
      Button {
        dismiss()
        hooks.navigate(.challenge(planItemId: planItemId, sessionId: sessionId))
      } label: {
        Text(
          "Open the challenge", tableName: "Practice",
          comment: "Opens a checkpoint's challenge intro to start it.")
      }
      .buttonStyle(.mainAction)
    }
  }

  private func duel(_ loaded: CheckpointLoad, state: CheckpointDuelState) -> some View {
    let question = state.currentQuestion
    let feedback = state.feedback
    let asked = question.map { question in
      PracticeQuestionView(
        question: question, labels: loaded.trueFalseLabels,
        result: feedback.map {
          PracticeItemResult(answer: $0.answer, correctAnswer: nil, isCorrect: $0.isCorrect)
        },
        isLocked: state.isPending || feedback != nil,
        askedIn: blockId,
        transcript: question.set.flatMap { state.transcripts[$0.id] },
        draft: $draft)
    }

    return PracticeTaskLayout(segments: state.segments, index: state.verdicts.count) {
      if state.kind != .weekly {
        HStack(spacing: 16) {
          if sizeClass == .regular {
            TricksterCharacter(
              cue: feedback.map {
                ActCue(id: state.verdicts.count, act: $0.isCorrect ? .sly : .smug)
              }
            )
            .frame(width: 104, height: 104)
          }

          ShieldGauge(correct: state.correct, passMark: state.passMark)
        }
      }

      if let asked {
        asked.stimulus
      } else {
        Text(
          "Every question is answered.", tableName: "Practice",
          comment: "A checkpoint with every answer in."
        )
        .font(.title3.weight(.semibold))
      }
    } response: {
      if let asked {
        asked.response

        if let feedback {
          PracticeFeedbackPanel(verdict: PracticeVerdict(isCorrect: feedback.isCorrect)) {
            Group {
              if let decision = state.decision {
                Text(
                  CheckpointCopy.decisionLine(decision, lessons: state.reinforcementLessons))
              } else if !feedback.isCorrect {
                Text(
                  "You'll see why at the end.", tableName: "Practice",
                  comment: "A checkpoint keeps its answers until it ends.")
              }
            }
            .foregroundStyle(.secondary)
          }
        }
      }
    } actions: {
      if state.failure != nil {
        PracticeSaveError { Task { await retry() } }
      }

      if feedback != nil {
        PracticeMainButton(
          title: state.isDone
            ? LocalizedStringResource(
              "See how it went", table: "Practice",
              comment: "Finishes a checkpoint to see its result.")
            : LocalizedStringResource(
              "Next", table: "Practice", comment: "Moves to a checkpoint's next question."),
          isBusy: state.isPending
        ) { Task { await next() } }
      } else if question == nil {
        PracticeMainButton(
          title: LocalizedStringResource(
            "See how it went", table: "Practice",
            comment: "Finishes a checkpoint to see its result."),
          isBusy: state.isPending
        ) { Task { await finish() } }
      } else {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Confirm", table: "Practice", comment: "Sends a checkpoint answer."),
          isBusy: state.isPending, isDisabled: draft?.complete == nil
        ) { Task { await confirm() } }
      }
    }
  }

  private func read() async {
    guard let identity = session.authenticatedSession else { return }

    do {
      let loaded = try await practice.api.checkpoint(token: identity.bearerToken, blockId: blockId)
      guard session.authenticatedSession == identity else { return }
      state = CheckpointDuelState(load: loaded)
      // Read again after an answer the server already had: the question in view may be another.
      draft = nil
      shownAt = .now
      load = .loaded(loaded)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  private func confirm() async {
    guard case .loaded(let loaded) = load, let question = state?.currentQuestion,
      let answer = draft?.complete, state?.isPending == false, state?.feedback == nil
    else { return }

    state?.confirm()
    let durationMs = Int(Date.now.timeIntervalSince(shownAt) * 1000)

    switch await practice.write(
      .answered,
      { identity in
        try await practice.api.answerStudy(
          token: identity.bearerToken, sessionId: loaded.checkpoint.sessionId, blockId: blockId,
          itemId: question.itemId, answer: answer, durationMs: durationMs)
      })
    {
    case .done(.answered(let feedback)):
      state?.answered(
        answer, isCorrect: feedback.isCorrect, itemId: question.itemId,
        reinforcementLessons: feedback.reinforcementLessons, transcript: feedback.transcript,
        setId: question.set?.id)
    case .done(.alreadyAnswered), .done(.blockNotActive):
      await read()
    case .refused, .failed:
      state?.failed(.answer)
    case .obsolete:
      break
    }
  }

  private func next() async {
    state?.next()
    draft = nil
    shownAt = .now

    if state?.isDone == true {
      await finish()
    }
  }

  private func finish() async {
    guard case .loaded(let loaded) = load else { return }

    state?.finishing()

    switch await practice.write(
      .finished,
      { identity in
        try await practice.api.finishStudyBlock(
          token: identity.bearerToken, sessionId: loaded.checkpoint.sessionId, blockId: blockId)
      })
    {
    case .done(let completion):
      state?.finished(completion)
    case .refused, .failed:
      state?.failed(.finish)
    case .obsolete:
      break
    }
  }

  private func retry() async {
    if state?.failure == .finish {
      await finish()
    } else {
      await confirm()
    }
  }
}

private struct ShieldGauge: View {
  let correct: Int
  let passMark: Int

  var body: some View {
    Gauge(value: Double(min(correct, passMark)), in: 0...Double(max(passMark, 1))) {
      Label {
        Text(
          "The Trickster's shield", tableName: "Practice",
          comment: "Label of the phase challenge's shield gauge.")
      } icon: {
        Image(systemName: "shield.lefthalf.filled")
      }
    } currentValueLabel: {
      Text(
        "\(min(correct, passMark)) of \(passMark) broken", tableName: "Practice",
        comment: "How much of the Trickster's shield is broken."
      )
      .monospacedDigit()
    }
    .tint(.success)
    .font(.subheadline)
  }
}

private struct CheckpointResultView: View {
  let load: CheckpointLoad
  let state: CheckpointDuelState
  @Binding var showsReview: Bool
  let close: () -> Void
  @Environment(\.practiceHooks) private var hooks
  @State private var ceremonyClosed = false

  var body: some View {
    let checkpoint = load.checkpoint
    let result = state.completion?.checkpoint
    let passed = result?.passed ?? checkpoint.result?.passed ?? false
    // A weekly challenge has no pass mark: finishing it wins its rewards, as on main.
    let won = checkpoint.kind == .weekly || passed
    let correct = result?.correct ?? checkpoint.result?.correct ?? state.correct
    let total = result?.total ?? checkpoint.result?.total ?? state.questionCount

    if let milestone = state.completion?.ceremony?.value1, !ceremonyClosed,
      let ceremony = hooks.ceremony
    {
      ceremony(milestone) { ceremonyClosed = true }
    } else {
      PracticeTaskLayout {
        if checkpoint.endedWithoutQuestions == true {
          PracticeResultTitle(
            title: LocalizedStringResource(
              "The questions were removed", table: "Practice",
              comment: "A checkpoint ended without questions."),
            detail: LocalizedStringResource(
              "You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.",
              table: "Practice",
              comment: "Why a checkpoint without questions isn't scored."))
        } else {
          // A result opened again draws him still.
          if checkpoint.kind != .weekly {
            TricksterCharacter(beaten: passed, reacts: state.completion != nil)
              .frame(width: 112, height: 112)
          }

          PracticeResultTitle(
            title: CheckpointCopy.resultTitle(kind: checkpoint.kind, passed: passed),
            detail: CheckpointCopy.resultDetail(
              kind: checkpoint.kind, passed: passed, lessons: state.reinforcementLessons))
        }
      } response: {
        if checkpoint.endedWithoutQuestions != true {
          PracticeResultNumbers(
            correct: correct, total: total,
            // A win's Brain Power is its rewards' first row, as on main.
            brainPower: won ? 0 : state.completion?.ownBrainPower ?? 0,
            facts: won
              ? []
              : (result?.passMark).map { passMark in
                [
                  String(
                    localized: "\(passMark) of \(state.questionCount) right to win",
                    table: "Practice",
                    comment: "Under a lost phase challenge's score: the right answers it needed.")
                ]
              } ?? [],
            reached: PracticeReached(
              energy: state.completion?.reached.energy,
              level: state.completion?.reached.level.map {
                .init(color: $0.color.rawValue, level: $0.level)
              }))

          if won {
            CheckpointRewards(
              checkpoint: checkpoint,
              brainPower: state.completion?.ownBrainPower ?? checkpoint.reward.brainPower)
          } else if let next = checkpoint.nextPhase?.value1 {
            Label {
              Text(
                "The next phase, \(next.name), is already open.", tableName: "Practice",
                comment: "After a phase challenge not won: the plan goes on.")
            } icon: {
              Image(systemName: "arrow.forward")
            }
          }

          if let answers = result?.answers, !answers.isEmpty {
            DisclosureGroup(isExpanded: $showsReview) {
              CheckpointReview(load: load, answers: answers, given: state.given)
            } label: {
              Text(
                "Review the answers", tableName: "Practice",
                comment: "Opens a finished checkpoint's answers with why."
              )
              .font(.headline)
            }
          }
        }
      } actions: {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Continue", table: "Practice", comment: "Moves on after a grade."), action: close)
      }
    }
  }
}

private struct CheckpointRewards: View {
  let checkpoint: Components.Schemas.Checkpoint
  let brainPower: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Rewards", tableName: "Practice", comment: "Heading over what a won challenge earned.")
        .font(.headline)

      LabeledContent {
        Text("+\(brainPower)", tableName: "Practice", comment: "Brain Power a challenge added.")
          .monospacedDigit()
          .foregroundStyle(.brain)
      } label: {
        Label {
          Text("Brain Power", tableName: "Practice", comment: "A challenge's Brain Power reward.")
        } icon: {
          Image(systemName: "brain")
        }
      }

      if checkpoint.reward.phaseComplete {
        Label {
          if let phase = checkpoint.phase?.value1 {
            Text(
              "Phase \(phase.index + 1) complete", tableName: "Practice",
              comment: "Reward of a won phase challenge: its phase is done.")
          } else {
            Text(
              "Phase complete", tableName: "Practice",
              comment: "Reward of a won phase challenge: its phase is done.")
          }
        } icon: {
          Image(systemName: "flag")
        }
      }

      if checkpoint.reward.badge {
        Label {
          Text(
            "Trap hunter badge", tableName: "Practice",
            comment: "Reward of a won phase challenge.")
        } icon: {
          Image(systemName: "rosette")
        }
      }

      if checkpoint.reward.phaseComplete, checkpoint.kind != .weekly,
        let next = checkpoint.nextPhase?.value1
      {
        Text(
          "Next phase", tableName: "Practice", comment: "Heading over the phase that comes next."
        )
        .font(.headline)
        .padding(.top, 8)

        Label {
          Text(next.name)
        } icon: {
          Image(systemName: "arrow.forward")
        }
      }
    }
  }
}

private struct CheckpointReview: View {
  let load: CheckpointLoad
  let answers: [Components.Schemas.StudyBlockCompletion.CheckpointPayload.AnswersPayloadPayload]
  /// The learner's picks from this visit; an answer given before it was right or isn't known.
  let given: [String: PracticeAnswer]

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      ForEach(load.questions) { question in
        if let answer = answers.first(where: { $0.itemId == question.itemId }) {
          let correctAnswer: PracticeAnswer? = try? PracticeJSON.recode(answer.correctAnswer)

          VStack(alignment: .leading, spacing: 10) {
            QuestionTitle(text: question.question, isMuted: true)

            if let correctAnswer {
              PracticeItemView(
                question: question, labels: load.trueFalseLabels,
                result: PracticeItemResult(
                  answer: given[question.itemId] ?? (answer.isCorrect ? correctAnswer : .dontKnow),
                  correctAnswer: correctAnswer, isCorrect: answer.isCorrect),
                isLocked: true, draft: .constant(nil))
            }

            PracticeFeedbackPanel(
              verdict: PracticeVerdict(isCorrect: answer.isCorrect),
              correctAnswerText: correctAnswer.flatMap {
                PracticeAnswerText.correctLine(
                  feedbackIsCorrect: answer.isCorrect, correctAnswer: $0, question: question,
                  labels: load.trueFalseLabels)
              },
              explanation: answer.explanation,
              workedSteps: answer.isCorrect ? [] : answer.workedSteps)
          }
        }
      }
    }
    .padding(.top, 8)
  }
}

enum CheckpointCopy {
  static func title(_ checkpoint: Components.Schemas.Checkpoint) -> LocalizedStringResource {
    switch checkpoint.kind {
    case .weekly:
      checkpoint.mock
        ? LocalizedStringResource(
          "Mock exam", table: "Practice", comment: "Title of a weekly mock exam block.")
        : LocalizedStringResource(
          "Weekly challenge", table: "Practice", comment: "Title of the weekly challenge block.")
    case .finalBoss:
      LocalizedStringResource(
        "Final challenge", table: "Practice", comment: "Title of the final challenge block.")
    case .boss:
      LocalizedStringResource(
        "Phase challenge", table: "Practice", comment: "Title of a phase challenge block.")
    }
  }

  static func resultTitle(kind: Components.Schemas.Checkpoint.KindPayload, passed: Bool)
    -> LocalizedStringResource
  {
    if kind == .weekly {
      return LocalizedStringResource(
        "Weekly challenge done", table: "Practice", comment: "End of the weekly challenge.")
    }

    return passed
      ? LocalizedStringResource(
        "You beat the Trickster!", table: "Practice", comment: "A won phase challenge.")
      : LocalizedStringResource(
        "Not this time", table: "Practice", comment: "A lost phase challenge.")
  }

  static func resultDetail(
    kind: Components.Schemas.Checkpoint.KindPayload, passed: Bool, lessons: Int
  )
    -> LocalizedStringResource?
  {
    if kind == .weekly { return nil }

    if passed { return nil }

    return newTry(lessons: lessons)
  }

  /// Under the verdict that decides a duel.
  static func decisionLine(_ decision: DuelDecision, lessons: Int) -> String {
    switch decision {
    case .won:
      String(
        localized: "His shield is broken. You won!", table: "Practice",
        comment: "Under the verdict that wins a phase challenge.")
    case .lost:
      [
        String(
          localized: "His shield held this time.", table: "Practice",
          comment: "Under the verdict that loses a phase challenge, before when it comes back."),
        String(localized: newTry(lessons: lessons)),
      ].joined(separator: " ")
    }
  }

  private static func newTry(lessons: Int) -> LocalizedStringResource {
    lessons == 0
      ? LocalizedStringResource(
        "New try tomorrow. Nothing is lost.", table: "Practice",
        comment: "A lost phase challenge comes back.")
      : LocalizedStringResource(
        "New try tomorrow, after \(lessons) short lessons. Nothing is lost.", table: "Practice",
        comment: "A lost phase challenge comes back after short lessons.")
  }
}
