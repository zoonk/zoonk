import SwiftUI

struct PronunciationScreen: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.dismiss) private var dismiss
  @State private var reviews: Resource<Components.Schemas.PronunciationReviews>?

  /// Nil for the active goal.
  var goalId: String? = nil

  var body: some View {
    NavigationStack {
      Group {
        if let reviews {
          content(reviews)
            .loads(reviews, refreshable: false)
        }
      }
      .navigationTitle(
        Text("Say it again", tableName: "Voice", comment: "Pronunciation round title")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
    .onAppear {
      guard reviews == nil, let goalId = goalId ?? learner.summary.value?.activeGoalID else {
        return
      }

      // A round reads its words once, when it opens: what grading changes later isn't this round's.
      reviews = voice.cache.resource(audience: .signedIn) { [api = voice.api] session in
        guard let session else {
          return nil
        }

        return try await api.pronunciationReviews(goalId: goalId, token: session.bearerToken)
      }
    }
  }

  @ViewBuilder
  private func content(_ reviews: Resource<Components.Schemas.PronunciationReviews>) -> some View {
    switch reviews.state {
    case .idle, .loading:
      ProgressView()
    case .empty, .failed(.notFound):
      StateMessage {
        Label {
          Text("Nothing to say again", tableName: "Voice", comment: "No pronunciation round found")
        } icon: {
          Image(systemName: "waveform")
        }
      }
      .lonePage()
    case .failed:
      PageLoadFailure {
        Label {
          Text(
            "The words didn't load", tableName: "Voice",
            comment: "Loading the pronunciation round failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } retry: {
        await reviews.refresh()
      }
    case .loaded(let value):
      PronunciationRoundView(reviews: value)
        .id(value.goalId)
    }
  }
}

private struct PronunciationRoundView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  @State private var round: PronunciationRound?
  @State private var recorder = VoiceRecorder()
  @State private var isSlow = false
  @State private var showsSaveReport = false

  let reviews: Components.Schemas.PronunciationReviews

  var body: some View {
    Group {
      if let round {
        roundView(round)
      } else {
        // Something to appear, so the round is made.
        Color.clear
      }
    }
    .onAppear {
      round = round ?? PronunciationRound(words: reviews.words, actions: actions)
    }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "pronunciation", reportType: .saveFailure), isReport: true
    )
    .onDisappear {
      recorder.cancel()
      voice.player.stop(owner: reviews.goalId)
    }
  }

  private var actions: PronunciationRound.Actions {
    let voice = voice
    let goalId = reviews.goalId

    return PronunciationRound.Actions(
      answer: { reviewId, roundId, recording in
        await voice.grade(invalidating: [.learnerModel]) { [api = voice.api] token in
          try await api.answerPronunciation(
            reviewId: reviewId, goalId: goalId, roundId: roundId, recording: recording,
            token: token)
        }
      },
      finish: { roundId in
        await voice.cache.mutate(invalidating: [.userProgress]) { [api = voice.api] identity in
          try await api.completePronunciationRound(
            roundId: roundId, goalId: goalId, token: identity.bearerToken)
        }
      })
  }

  @ViewBuilder
  private func roundView(_ round: PronunciationRound) -> some View {
    switch round.step {
    case .result(let result):
      PronunciationResultView(isEmpty: round.words.isEmpty, result: result) {
        dismiss()
      }
    case .word(_, let state):
      if let word = round.current {
        let canRecord = canRecord(state)

        QuestionSpread(
          readableWidth: PracticeLayout.readableWidth, spacing: 24, note: note(state)?.note,
          usesPracticeBar: true
        ) {
          EmptyView()
        } stimulus: {
          RoundMeter(round: round)

          PronunciationWordView(
            word: word, language: reviews.language, owner: reviews.goalId,
            canListen: !isTakeOn,
            cue: canRecord ? RecordCue(recorder: recorder, isChecking: round.isPending) : nil
          )
          .id(word.id)
        } response: {
          wordStatus(state)
        } actions: {
          VStack(spacing: 12) {
            if round.finishFailures > 0, !round.isPending {
              finishError(round)
            }

            wordActions(round, state: state)
          }
        }
        .taskOptions(
          isShown: canRecord,
          label: Text("Screen options", tableName: "Voice", comment: "The round's options menu")
        ) {
          skipButton(round)
        }
        .sensoryFeedback(trigger: state) { _, new in
          guard case .graded(let grade) = new else {
            return nil
          }

          return grade.isCorrect ? .success : .error
        }
        .announcesStatus(announcement(state))
        .slowCheck(round.isPending, isSlow: $isSlow)
      }
    }
  }

  private func canRecord(_ state: PronunciationRound.WordState) -> Bool {
    if case .ready = state { return recorder.microphoneProblem == nil }
    return false
  }

  private func skipButton(_ round: PronunciationRound) -> some View {
    Button {
      Task { await round.next() }
    } label: {
      Label {
        Text("Skip", tableName: "Voice", comment: "Skips a word in the round")
      } icon: {
        Image(systemName: "forward.end")
      }
    }
    .disabled(round.isPending || isTakeOn)
  }

  private var isTakeOn: Bool {
    recorder.isRecording || recorder.status == .acquiring
  }

  @ViewBuilder
  private func wordStatus(_ state: PronunciationRound.WordState) -> some View {
    switch state {
    case .graded(let grade):
      GradeNote(grade: grade)
    case .ready(let notice):
      if case .limit(let limit) = notice, !recorder.isRecording {
        LimitNotice(limit: limit)
      }
    }
  }

  /// The bar's line over Record, in the words every screen that records uses.
  private func note(_ state: PronunciationRound.WordState) -> RecordNote? {
    guard case .ready(let notice) = state else {
      return nil
    }

    switch recorder.microphoneProblem {
    case .unavailable:
      return .microphoneUnavailable
    case .denied:
      return .microphoneOff(
        String(
          localized:
            "Turn on the microphone for Zoonk in Settings to say the word. You can skip it for now.",
          table: "Voice", comment: "How to say a word when the microphone is off"))
    case nil:
      break
    }

    if isTakeOn {
      return nil
    }

    if round?.isPending == true {
      return isSlow ? .slow : nil
    }

    switch notice {
    case .noSpeech: return .noSpeech
    case .missedStart: return .missedStart
    case .failed: return .failed
    case .limit, nil: return nil
    }
  }

  /// The verdict and a limit; the bar reads its own line.
  private func announcement(_ state: PronunciationRound.WordState) -> String? {
    switch state {
    case .graded(let grade):
      return grade.verdict
    case .ready(let notice):
      guard !recorder.isRecording, case .limit(let limit) = notice else {
        return nil
      }

      return limit.words().said
    }
  }

  @ViewBuilder
  private func wordActions(_ round: PronunciationRound, state: PronunciationRound.WordState)
    -> some View
  {
    switch state {
    case .graded(let grade):
      ButtonRow(spacing: 12) {
        if !grade.isCorrect {
          Button {
            round.tryAgain()
          } label: {
            Label {
              Text("Try again", tableName: "Voice", comment: "Says the same word again")
            } icon: {
              Image(systemName: "arrow.counterclockwise")
            }
          }
          .buttonStyle(.outline)
          .controlSize(.large)
        }

        BusyButton(isBusy: round.isPending) {
          Task { await round.next() }
        } label: {
          if round.isLast {
            Text("See result", tableName: "Voice", comment: "Ends the round")
          } else {
            Text("Continue", tableName: "Voice", comment: "Goes on to the next word")
          }
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .buttonSizing(.flexible)
        .keyboardShortcut(.defaultAction)
      }
    case .ready:
      if recorder.microphoneProblem != nil {
        Button {
          Task { await round.next() }
        } label: {
          Text("Skip", tableName: "Voice", comment: "Skips a word in the round")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      } else {
        RecordButton(recorder: recorder, isChecking: round.isPending) {
          Task {
            voice.player.stopAny()
            await recorder.start { recording in
              Task { await round.record(recording) }
            }
          }
        }
        .practiceMainAction()
      }
    }
  }

  private func finishError(_ round: PronunciationRound) -> some View {
    HStack {
      SaveFailureNotice(
        failures: round.finishFailures,
        firstMessage: LocalizedStringResource(
          "We couldn't save your answers.", table: "Voice",
          comment: "Finishing the round failed"),
        onReport: { showsSaveReport = true }
      )
      .typeStyle(.body)

      Spacer()

      Button {
        Task { await round.finish() }
      } label: {
        Text("Try again", tableName: "Voice", comment: "Retries saving the round")
      }
      .buttonStyle(.outline)
    }
  }
}

private struct RoundMeter: View {
  let round: PronunciationRound

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        "Word \(round.index + 1) of \(round.words.count)", tableName: "Voice",
        comment: "Where the learner is in the round"
      )
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

      MeterParts(
        parts: round.words.indices.map { position in
          switch round.outcomes[position] {
          case .right:
            .init(fill: .color(.success))
          case .wrong:
            .init(fill: .color(.destructive))
          case .skipped:
            .init(fill: .color(Color.faint))
          case nil:
            .init(fill: position == round.index ? .current : .track)
          }
        })
    }
  }
}

private struct GradeNote: View {
  let grade: PronunciationRound.Grade

  var body: some View {
    if grade.isCorrect {
      Label {
        Text(grade.verdict)
      } icon: {
        Image(systemName: "checkmark.circle.fill")
      }
      .typeStyle(.body.weight(.semibold))
      .foregroundStyle(.successText)
    } else {
      Text(grade.verdict)
        .typeStyle(.body.weight(.semibold))
    }
  }
}

extension PronunciationRound.Grade {
  fileprivate var verdict: String {
    isCorrect
      ? String(localized: "That sounded right", table: "Voice", comment: "A word said right")
      : String(
        localized: "We heard “\(transcript)”", table: "Voice",
        comment: "What the grader heard when a word didn't sound right")
  }
}

private struct PronunciationResultView: View {
  let isEmpty: Bool
  let result: PronunciationRound.Result?
  let done: () -> Void

  private var day: DayResult? {
    result.flatMap { DayResult($0) }
  }

  var body: some View {
    if isEmpty {
      StateMessage {
        Label {
          Text(
            "No words to say again today.", tableName: "Voice",
            comment: "Nothing due in a pronunciation round")
        } icon: {
          Image(systemName: "checkmark.circle")
        }
      }
      .bottomBar { doneButton }
      .lonePage()
    } else {
      PaneSplit {
        ZoonkList {
          summary
          dayMoment
        }
      } secondary: {
        Color.clear
          .bottomBar { doneButton }
      } single: {
        ZoonkList {
          summary
          dayMoment
        }
        .bottomBar { doneButton }
      }
      .completionMoments(day)
    }
  }

  @ViewBuilder private var summary: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Group {
          if result == nil {
            Text(
              "Nothing said this time", tableName: "Voice", comment: "A round with no answers")
          } else {
            Text("Practice done", tableName: "Voice", comment: "A finished round")
          }
        }
        .typeStyle(.section)
      }
      .listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
    }

    if let result {
      Section {
        LabeledContent {
          Text(
            "\(result.correct) of \(result.total)", tableName: "Voice",
            comment: "Words that sounded right out of those said"
          )
          .monospacedDigit()
        } label: {
          Text("Sounded right", tableName: "Voice", comment: "Readout label for right words")
        }

        IconLabeledContent {
          Text(result.brainPower, format: .number.sign(strategy: .always(includingZero: false)))
            .monospacedDigit()
            .foregroundStyle(.brainText)
        } title: {
          Text("Brain Power", tableName: "Voice", comment: "Points earned label")
        } icon: {
          Image(systemName: "brain.head.profile")
            .foregroundStyle(.brain)
            .accessibilityHidden(true)
        }
      }
    }
  }

  @ViewBuilder private var dayMoment: some View {
    if let day {
      DayMomentSections(result: day)
    }
  }

  private var doneButton: some View {
    Button(action: done) {
      Text("Done", tableName: "Voice", comment: "Closes the finished round")
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }
}
