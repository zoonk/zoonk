import SwiftUI

/// "Say it again": the words a language learner mispronounced, back when they're due, one at a
/// time with their native sound, a slow version, the respelling and the tip; they record it, see
/// what we heard, and try again or go on, and the round counts toward their day at the end. A word
/// they can't say right now is skipped from the "…" menu. Nothing due shows a short note.
struct PronunciationScreen: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.dismiss) private var dismiss
  @State private var reviews: Resource<Components.Schemas.PronunciationReviews>?

  /// The goal whose words to say again; the active goal when the link names none.
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
      ContentUnavailableView {
        Label {
          Text("Nothing to say again", tableName: "Voice", comment: "No pronunciation round found")
        } icon: {
          Image(systemName: "waveform")
        }
      }
    case .failed:
      ContentUnavailableView {
        Label {
          Text(
            "The words didn't load", tableName: "Voice",
            comment: "Loading the pronunciation round failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await reviews.refresh() }
        } label: {
          Text("Try again", tableName: "Voice", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    case .loaded(let value):
      PronunciationRoundView(reviews: value)
        .id(value.goalId)
    }
  }
}

/// A round over the words it opened with.
private struct PronunciationRoundView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  @State private var round: PronunciationRound?
  @State private var recorder = VoiceRecorder()

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
        // The word's next review moves.
        await voice.grade(invalidating: [.learnerModel]) { [api = voice.api] token in
          try await api.answerPronunciation(
            reviewId: reviewId, goalId: goalId, roundId: roundId, recording: recording,
            token: token)
        }
      },
      finish: { roundId in
        // Brain Power, today's time and missions.
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
      PronunciationResultView(isEmpty: round.words.isEmpty, result: result)
        .safeAreaBar(edge: .bottom) {
          Button {
            dismiss()
          } label: {
            Text("Done", tableName: "Voice", comment: "Closes the finished round")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .keyboardShortcut(.defaultAction)
          .scenePadding()
          .keepsOffFold()
        }
    case .word(_, let state):
      if let word = round.current {
        ScrollView {
          VStack(alignment: .leading, spacing: 24) {
            RoundMeter(round: round)

            PronunciationWordView(word: word, language: reviews.language, owner: reviews.goalId)
              .id(word.id)

            wordStatus(state)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .scenePadding()
        }
        .safeAreaBar(edge: .bottom) {
          VStack(spacing: 12) {
            if round.finishFailed {
              finishError(round)
            }

            wordActions(round, state: state)
          }
          .scenePadding()
          .keepsOffFold()
        }
        .taskOptions(
          isShown: showsOptions(state),
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
      }
    }
  }

  /// Skipping a word is offered while it waits to be said and the microphone is on.
  private func showsOptions(_ state: PronunciationRound.WordState) -> Bool {
    if case .ready = state { return !recorder.isDenied }
    return false
  }

  private func skipButton(_ round: PronunciationRound) -> some View {
    Button {
      Task { await round.next() }
    } label: {
      Label {
        Text("Skip this word", tableName: "Voice", comment: "Skips a word in the round")
      } icon: {
        Image(systemName: "forward.end")
      }
    }
    .disabled(round.isPending || recorder.isRecording)
  }

  @ViewBuilder
  private func wordStatus(_ state: PronunciationRound.WordState) -> some View {
    switch state {
    case .graded(let grade):
      GradeNote(grade: grade)
    case .ready(let notice):
      if recorder.isDenied {
        MicrophoneOffView(
          description: Text(
            "Turn on the microphone for Zoonk in Settings to say the word. You can skip it for now.",
            tableName: "Voice", comment: "How to say a word when the microphone is off")
        ) {}
      } else if case .limit(let limit) = notice {
        HelpLimitNotice(limit: limit)
      } else {
        Text(statusLine(notice))
          .font(.subheadline)
          .foregroundStyle(
            notice == .failed ? AnyShapeStyle(.destructive) : AnyShapeStyle(.secondary))
      }
    }
  }

  private func statusLine(_ notice: PronunciationRound.Notice?) -> String {
    if round?.isPending == true {
      return String(
        localized: "Listening to how it sounded…", table: "Voice",
        comment: "Shown while a word said out loud is graded")
    }

    if recorder.isRecording {
      return String(
        localized: "Recording… Press Stop when you're done.", table: "Voice",
        comment: "Shown while the learner records a word")
    }

    switch notice {
    case .noSpeech:
      return String(
        localized: "We couldn't hear the word. Try again a little closer.", table: "Voice",
        comment: "A recording had no word in it")
    case .failed:
      return String(
        localized: "That didn't go through. Try again.", table: "Voice",
        comment: "Grading a word failed")
    case .limit, nil:
      return String(
        localized: "Press Record and say the word out loud", table: "Voice",
        comment: "Asks the learner to say the word")
    }
  }

  @ViewBuilder
  private func wordActions(_ round: PronunciationRound, state: PronunciationRound.WordState)
    -> some View
  {
    switch state {
    case .graded(let grade):
      HStack(spacing: 12) {
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
          .buttonStyle(.bordered)
          .controlSize(.large)
        }

        Button {
          Task { await round.next() }
        } label: {
          Group {
            if round.isLast {
              Text("See how it went", tableName: "Voice", comment: "Ends the round")
            } else {
              Text("Continue", tableName: "Voice", comment: "Goes on to the next word")
            }
          }
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
        .disabled(round.isPending)
      }
    case .ready:
      if recorder.isDenied {
        Button {
          Task { await round.next() }
        } label: {
          Text("Skip this word", tableName: "Voice", comment: "Skips a word in the round")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      } else {
        RecordButton(recorder: recorder, isDisabled: round.isPending) {
          Task {
            voice.player.stop(owner: reviews.goalId)
            await recorder.start { recording in
              Task { await round.record(recording) }
            }
          }
        }
      }
    }
  }

  private func finishError(_ round: PronunciationRound) -> some View {
    HStack {
      Text(
        "We couldn't save your answers.", tableName: "Voice", comment: "Finishing the round failed"
      )
      .font(.subheadline)
      .foregroundStyle(.destructive)

      Spacer()

      Button {
        Task { await round.finish() }
      } label: {
        Text("Try again", tableName: "Voice", comment: "Retries saving the round")
      }
      .buttonStyle(.bordered)
    }
  }
}

/// One part per word: blue once it sounded right, pink when it didn't yet, quiet if skipped, a ring
/// on the word in view, then the ones ahead.
private struct RoundMeter: View {
  let round: PronunciationRound

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        "Word \(round.index + 1) of \(round.words.count)", tableName: "Voice",
        comment: "Where the learner is in the round"
      )
      .font(.caption.monospacedDigit())
      .foregroundStyle(.secondary)

      MeterParts(
        parts: round.words.indices.map { position in
          switch round.outcomes[position] {
          case .right:
            .init(fill: .color(.success))
          case .wrong:
            .init(fill: .color(.destructive))
          case .skipped:
            .init(fill: .color(Color(.tertiaryLabel)))
          case nil:
            .init(fill: position == round.index ? .current : .track)
          }
        })
    }
  }
}

/// What the grader heard, and when the word comes back.
private struct GradeNote: View {
  let grade: PronunciationRound.Grade

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if grade.isCorrect {
        Label {
          Text("That sounded right", tableName: "Voice", comment: "A word said right")
        } icon: {
          Image(systemName: "checkmark.circle.fill")
        }
        .font(.headline)
        .foregroundStyle(.success)
      } else {
        Text(
          "We heard “\(grade.transcript)”", tableName: "Voice",
          comment: "What the grader heard when a word didn't sound right"
        )
        .font(.headline)
      }

      Group {
        if let next = grade.nextReviewAt {
          Text(
            "It comes back \(next.formatted(.dateTime.day().month(.wide))).", tableName: "Voice",
            comment: "When the word comes back to say again")
        } else {
          Text(
            "You've got this one. It won't come back.", tableName: "Voice",
            comment: "A word that's learned")
        }
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }
}

/// The round's end: "Practice done" with what an accent means under it, the tries that sounded
/// right and the Brain Power it paid; with nothing said, its own title.
private struct PronunciationResultView: View {
  let isEmpty: Bool
  let result: PronunciationRound.Result?

  /// What the round did to the learner's day.
  private var day: DayResult? {
    result.flatMap { DayResult($0) }
  }

  var body: some View {
    if isEmpty {
      ContentUnavailableView {
        Label {
          Text(
            "No words to say again today.", tableName: "Voice",
            comment: "Nothing due in a pronunciation round")
        } icon: {
          Image(systemName: "checkmark.circle")
        }
      }
    } else {
      List {
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
            .font(.title2.weight(.semibold))

            Text(
              "An accent never blocks you. Words that still sound different come back tomorrow.",
              tableName: "Voice", comment: "What a pronunciation round's grade means"
            )
            .foregroundStyle(.secondary)
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

            LabeledContent {
              Text(result.brainPower, format: .number)
                .monospacedDigit()
                .foregroundStyle(.brain)
            } label: {
              Label {
                Text("Brain Power", tableName: "Voice", comment: "Points earned label")
              } icon: {
                Image(systemName: "brain.head.profile")
                  .foregroundStyle(.brain)
                  .accessibilityHidden(true)
              }
            }
          }

          if let day {
            DayMomentSections(result: day)
          }
        }
      }
      .milestoneCeremony(day?.ceremony)
    }
  }
}
