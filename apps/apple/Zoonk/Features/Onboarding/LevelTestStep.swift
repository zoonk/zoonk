import SwiftUI

/// When the language pair's questions don't exist yet, only the learner's Start asks for them.
struct LevelTestStep: View {
  let goalID: String
  /// The learner's own language.
  let language: String
  let targetLanguage: String
  let onDone: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var phase = Phase.loading
  @State private var levels: [LevelTest.Level] = []
  @State private var shownAt = ContinuousClock.now
  @State private var isSaving = false
  @State private var failed = false

  private enum Phase {
    case loading
    case intro
    case preparing(generationID: String)
    case question(LevelTest.Question, number: Int, progress: Double)
    case speaking(LevelTest.Sentence, progress: Double)
    case done
  }

  var body: some View {
    Group {
      switch phase {
      case .loading:
        ProgressView()
      case .intro:
        LevelTestIntro(
          language: language, targetLanguage: targetLanguage, isSaving: isSaving, failed: failed,
          onStart: { Task { await begin() } }, onSkip: finish)
      case .preparing(let generationID):
        preparing(generationID)
      case .question(let question, let number, let progress):
        questionScreen(question, number: number, progress: progress)
          .id(question.id)
      case .speaking(let sentence, let progress):
        LevelTestSpeaking(
          goalID: goalID, sentence: sentence, progress: progress, onTest: show,
          onSkip: { phase = .done })
      case .done:
        LevelTestDone(levels: levels, isSaving: isSaving, failed: failed, onContinue: finish)
      }
    }
    .task { await resume() }
  }

  private func preparing(_ generationID: String) -> some View {
    GenerationWaitView(
      title: LocalizedStringResource(
        "Preparing your level test", table: "Onboarding",
        comment: "Title while a language's level test questions are written"),
      description: LocalizedStringResource(
        "The \(languageName(targetLanguage)) test is new in your language, so its questions are being written now. It usually takes a minute or two, and only this once.",
        table: "Onboarding", comment: "Why the level test waits: the language's name"),
      generationID: generationID,
      kind: .levelTestBank,
      restart: { try await onboarding.prepareLevelTest(goalID: goalID) },
      readResult: {
        guard let test = try? await onboarding.levelTest(goalID: goalID), test.status == .ready
        else {
          return false
        }

        show(test)
        return true
      },
      trailing: {
        skipSection
      })
  }

  private var skipSection: some View {
    Section {
      Button(action: finish) {
        Text(
          "Skip the test", tableName: "Onboarding", comment: "Skips a language goal's level test"
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
      .disabled(isSaving)
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)
    } footer: {
      Text(
        "Your plan starts from the level you gave, and your first sessions fine-tune it.",
        tableName: "Onboarding", comment: "What skipping the level test does")
    }
  }

  private func questionScreen(_ question: LevelTest.Question, number: Int, progress: Double)
    -> some View
  {
    let isListening = question.skill == .listening
    var shown = PracticeQuestion(
      itemId: question.id, format: .multipleChoice, question: question.question,
      options: question.options)
    shown.context = isListening ? nil : question.passage
    shown.placement = true

    return PlacementQuestionScreen(
      number: number, progress: progress, question: shown,
      dontKnowLabel: isListening
        ? LocalizedStringResource(
          "I didn't understand the audio", table: "Onboarding",
          comment: "Answers a listening question of the level test without guessing")
        : LocalizedStringResource(
          "I don't know yet", table: "Onboarding",
          comment: "Answers a placement question without guessing"),
      isSaving: isSaving, failed: failed,
      onAnswer: { answer(question, with: $0) },
      onStop: { phase = .done },
      media: {
        if isListening {
          ListeningMessage(text: question.passage, language: targetLanguage)
        }
      })
  }

  /// Without answers it starts from its intro, and only the learner's Start asks for questions.
  private func resume() async {
    guard case .loading = phase else {
      return
    }

    guard let test = try? await onboarding.levelTest(goalID: goalID), test.status == .ready,
      (test.answered ?? 0) > 0
    else {
      phase = .intro
      return
    }

    show(test)
  }

  private func begin() async {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false
    defer { isSaving = false }

    do {
      if let generationID = try await onboarding.prepareLevelTest(goalID: goalID) {
        phase = .preparing(generationID: generationID)
      } else {
        show(try await onboarding.levelTest(goalID: goalID))
      }
    } catch is CancellationError {
    } catch {
      failed = true
    }
  }

  private func show(_ test: LevelTest) {
    guard test.status == .ready, let next = test.next else {
      return
    }

    levels = test.levels ?? levels
    failed = false
    let answered = test.answered ?? 0
    let progress = Double(answered) / Double(max(1, test.total ?? 1))

    switch next.kind {
    case "question":
      if let question = next.question {
        shownAt = .now
        phase = .question(question, number: answered + 1, progress: progress)
      }
    case "speaking":
      if let sentence = next.speaking {
        phase = .speaking(sentence, progress: progress)
      }
    default:
      phase = .done
    }
  }

  private func answer(_ question: LevelTest.Question, with answer: PracticeAnswer) {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        let index: Int? =
          switch answer {
          case .choice(let index): index
          default: nil
          }

        show(
          try await onboarding.answerLevelTest(
            goalID: goalID, questionID: question.id, answerIndex: index,
            duration: shownAt.duration(to: .now)))
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  private func finish() {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        try await onboarding.finishLevelTest(goalID: goalID)
        onDone()
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }
}

private func baseLanguage(_ code: String) -> String {
  String(code.lowercased().prefix { $0 != "-" && $0 != "_" })
}

private func languageName(_ code: String) -> String {
  Locale.current.localizedString(forLanguageCode: code) ?? code
}

private struct LevelTestIntro: View {
  let language: String
  let targetLanguage: String
  let isSaving: Bool
  let failed: Bool
  let onStart: () -> Void
  let onSkip: () -> Void

  @Environment(\.openURL) private var openURL

  var body: some View {
    Form {
      StepHeader(
        title: Text(
          "Let's see your level in \(languageName(targetLanguage))", tableName: "Onboarding",
          comment: "Title of a language goal's level test"),
        description: Text(
          "About three minutes of reading, listening and one sentence out loud, so your plan starts at your level.",
          tableName: "Onboarding", comment: "What the level test is"))

      if usesNonLatinScript {
        Section {
          Text(
            "New to its alphabet? Skip the test. Your first session starts with a short lesson on reading it.",
            tableName: "Onboarding", comment: "The level test of a language with another alphabet")
        }
      }

      if failed {
        Section {
          Text(
            "That didn't work. Try again in a moment.", tableName: "Onboarding",
            comment: "Starting or skipping the level test failed"
          )
          .foregroundStyle(.destructive)
        }
      }

      StepButtons(
        canContinue: !isSaving, canSkip: !isSaving,
        continueLabel: Text("Start", tableName: "Onboarding", comment: "Starts the level test"),
        skipLabel: Text(
          "Skip the test", tableName: "Onboarding", comment: "Skips a language goal's level test"),
        onContinue: onStart, onSkip: onSkip)

      if offersOwnLanguage, let settings = URL(string: UIApplication.openSettingsURLString) {
        Section {
          Button {
            openURL(settings)
          } label: {
            Text(
              "Use the app in \(Locale(identifier: language).localizedString(forLanguageCode: language) ?? language)",
              tableName: "Onboarding",
              comment: "Opens the app's settings to switch its language: the language's own name")
          }
        }
      }
    }
  }

  /// Mirrors main's list.
  private var usesNonLatinScript: Bool {
    Self.nonLatinLanguages.contains(baseLanguage(targetLanguage))
  }

  private static let nonLatinLanguages: Set = [
    "am", "ar", "be", "bg", "bn", "bo", "dv", "el", "fa", "gu", "he", "hi", "hy", "ja", "ka", "km",
    "kn", "ko", "lo", "mk", "ml", "mn", "mr", "my", "ne", "pa", "ps", "ru", "sd", "si", "sr", "ta",
    "te", "th", "ti", "uk", "ur", "yi", "zh",
  ]

  private var offersOwnLanguage: Bool {
    let base = baseLanguage(language)
    let shown = Bundle.main.preferredLocalizations.first.map(baseLanguage)
    return base != shown && Bundle.main.localizations.contains(base)
  }
}

/// Read a little slower than normal, so the test isn't one of catching fast speech.
private struct ListeningMessage: View {
  let text: String
  let language: String

  @Environment(VoiceServices.self) private var voice
  @State private var owner = UUID()
  @State private var played = false

  var body: some View {
    let state = voice.player.state(for: owner)

    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Button {
          if state == .loading || state == .playing {
            voice.player.stop(owner: owner)
          } else {
            played = true
            Task {
              await voice.player.play(.text(text, language: language), rate: 0.9, owner: owner)
            }
          }
        } label: {
          Label {
            played
              ? Text(
                "Play the message again", tableName: "Onboarding",
                comment: "Plays a listening question's message again")
              : Text(
                "Play the message", tableName: "Onboarding",
                comment: "Plays a listening question's message")
          } icon: {
            switch state {
            case .loading:
              ProgressView()
            case .playing:
              Image(systemName: "stop.fill")
            case .idle, .failed:
              Image(systemName: "play.fill")
            }
          }
          .labelStyle(.iconOnly)
          .frame(width: 28, height: 28)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.circle)
        .controlSize(.large)

        Label {
          state == .loading
            ? Text(
              "Getting the message ready. The first time can take a few seconds.",
              tableName: "Onboarding", comment: "While a listening question's message loads")
            : Text(
              "You got a voice message. Listen and answer.", tableName: "Onboarding",
              comment: "Next to a listening question's play button")
        } icon: {
          Image(systemName: "headphones")
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }

      if case .failed(let limit) = state {
        if let limit {
          HelpLimitNotice(limit: limit)
        } else {
          Text(
            "The audio didn't play. Here's what it says:", tableName: "Onboarding",
            comment: "Over a listening question's text when its audio failed"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }

        Text(text)
      }
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(.background, in: .rect(cornerRadius: 16))
    .onDisappear { voice.player.stop(owner: owner) }
  }
}

/// Like the test's other questions it has no way back; skipping it ends the test.
private struct LevelTestSpeaking: View {
  let goalID: String
  let sentence: LevelTest.Sentence
  let progress: Double
  let onTest: (LevelTest) -> Void
  let onSkip: () -> Void

  var body: some View {
    PracticeTaskLayout {
      ProgressView(value: progress)
        .tint(.success)
        .accessibilityHidden(true)

      Text(
        "Say it out loud", tableName: "Onboarding", comment: "Title of the level test's sentence"
      )
      .font(.title2.bold())
      .accessibilityAddTraits(.isHeader)

      VStack(alignment: .leading, spacing: 4) {
        Text(sentence.sentence)
          .font(.title3.weight(.semibold))
        Text(sentence.translation)
          .foregroundStyle(.secondary)
      }

      VoiceAnswerRecorder(
        grade: { voice, recording in
          await voice.gradeLevelTestSentence(goalId: goalID, recording: recording)
        },
        onGraded: { result in
          if let test = try? PracticeJSON.recode(result.test, as: LevelTest.self) {
            onTest(test)
          }
        })
    } actions: {
      Button(action: onSkip) {
        Text("Skip this part", tableName: "Onboarding", comment: "Skips the level test's sentence")
      }
    }
  }
}

private struct LevelTestDone: View {
  let levels: [LevelTest.Level]
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void

  var body: some View {
    Form {
      StepHeader(
        title: Text(
          "Your level today", tableName: "Onboarding", comment: "Title after the level test"),
        description: Text(
          "Based on the test. It gets more accurate every week.", tableName: "Onboarding",
          comment: "Under the level test's result"))

      if !levels.isEmpty {
        Section {
          ForEach(levels) { level in
            LabeledContent {
              Text(level.label)
                .monospacedDigit()
            } label: {
              VStack(alignment: .leading, spacing: 6) {
                skillName(level.skill)
                ProgressView(value: level.score, total: 5)
                  .accessibilityHidden(true)
              }
            }
          }
        }
      }

      if failed {
        Section {
          Text(
            "That didn't work. Try again in a moment.", tableName: "Onboarding",
            comment: "Starting or skipping the level test failed"
          )
          .foregroundStyle(.destructive)
        }
      }

      StepButtons(
        canContinue: !isSaving,
        continueLabel: Text(
          "Build my plan", tableName: "Onboarding", comment: "Ends the level test to build the plan"
        ),
        onContinue: onContinue)
    }
  }

  private func skillName(_ skill: LevelTest.Skill) -> Text {
    switch skill {
    case .listening:
      Text("Listening", tableName: "Onboarding", comment: "A language skill")
    case .reading:
      Text("Reading", tableName: "Onboarding", comment: "A language skill")
    case .speaking:
      Text("Speaking", tableName: "Onboarding", comment: "A language skill")
    case .writing:
      Text("Writing", tableName: "Onboarding", comment: "A language skill")
    }
  }
}
