import SwiftUI

extension LevelTest.Question {
  /// Main's wait for a listening message the bank's run is still voicing: reads the test every few
  /// seconds until the clip comes or can't (the run stopped making it, or three reads in a row failed),
  /// and returns nil once the test moved on to another question. Without a clip, the play button asks
  /// for one.
  @MainActor
  func waitingForAudio(
    every interval: Duration = .seconds(3), read: @MainActor () async throws -> LevelTest
  ) async throws -> Self? {
    var failures = 0

    while failures < 3 {
      try await Task.sleep(for: interval)

      do {
        guard let shown = try await read().next?.question, shown.id == id else {
          return nil
        }

        guard shown.audioPending else {
          return shown
        }

        failures = 0
      } catch is CancellationError {
        throw CancellationError()
      } catch {
        failures += 1
      }
    }

    var shown = self
    shown.audioPending = false
    return shown
  }
}

extension PracticeAnswer {
  /// The one option a level test question's answer picked.
  var levelTestIndex: Int? {
    if case .choice(let index) = self { index } else { nil }
  }

  /// A confirmation's picks: every option the learner thinks is right.
  var levelTestIndices: [Int]? {
    if case .choices(let indexes) = self { indexes } else { nil }
  }
}

/// A level test question: a reading passage or a listening message and its options. A confirmation
/// asks for every right option, so a guess rarely passes.
struct LevelTestQuestionScreen: View {
  let question: LevelTest.Question
  var selectsAll = false
  let number: Int
  let total: Int
  /// The server's word that stopping now saves something.
  let canStop: Bool
  let targetLanguage: String
  let isSaving: Bool
  let failures: Int
  var context: AnalyticsEvent.TestContext?
  let onReport: () -> Void
  /// `skips`: a message the learner can't hear yet, whose "I don't know" doesn't count.
  let onAnswer: (_ answer: PracticeAnswer, _ skips: Bool) -> Void
  /// "Can't listen now", on every listening question.
  let onDeferAudio: () -> Void
  let onStop: () -> Void

  @Environment(VoiceServices.self) private var voice
  /// The player is app-wide, and another window can show the same bank question.
  @State private var audioOwner = UUID()

  var body: some View {
    let isListening = question.skill == .listening
    let owner = AnyHashable([audioOwner.uuidString, question.id])
    let audioFailed = if case .failed = voice.player.state(for: owner) { true } else { false }
    // A message the learner can't hear yet is skipped: answering it would move their level.
    let skips = isListening && (question.audioPending || audioFailed)
    var shown = PracticeQuestion(
      itemId: question.id, format: .multipleChoice, question: question.question,
      options: question.options, select: selectsAll ? .all : .one)
    shown.context = isListening ? nil : question.passage

    return PlacementQuestionScreen(
      subject: languageSkillName(question.skill.rawValue), number: number, total: total,
      question: shown,
      dontKnowLabel: skips
        ? LocalizedStringResource(
          "Skip this question", table: "Onboarding"
        )
        : isListening
          ? LocalizedStringResource(
            "I didn't understand the audio", table: "Onboarding")
          : LocalizedStringResource(
            "I don't know yet", table: "Onboarding",
            comment: "Answers a placement question without guessing"),
      defersAudio: isListening ? onDeferAudio : nil,
      isSaving: isSaving, failures: failures, context: context,
      onReport: onReport,
      onAnswer: { onAnswer($0, skips) },
      onStop: canStop ? onStop : nil,
      media: {
        if isListening {
          ListeningMessage(question: question, language: targetLanguage, owner: owner)
        }
      })
  }
}

/// "Use the app in Português": a learner whose own language the app speaks, and whose device shows
/// another, can switch in the system's settings. Under onboarding's level result.
struct AppLanguageAction: View {
  /// The learner's own language, as the goal has it.
  let language: String

  @Environment(\.openURL) private var openURL

  var body: some View {
    // A quiet link under the result, drawn like "Test out of B2", as main's.
    if offersOwnLanguage, let settings = URL(string: UIApplication.openSettingsURLString) {
      Button {
        openURL(settings)
      } label: {
        Text(
          "Use the app in \(Locale(identifier: language).localizedString(forLanguageCode: language) ?? language)",
          tableName: "Onboarding",
          comment: "Opens the app's settings to switch its language: the language's own name"
        )
        .underline()
      }
      .buttonStyle(.borderless)
      .listRowSeparator(.hidden)
    }
  }

  private var offersOwnLanguage: Bool {
    let base = baseLanguage(language)
    let shown = Bundle.main.preferredLocalizations.first.map(baseLanguage)
    return base != shown && Bundle.main.localizations.contains(base)
  }

  private func baseLanguage(_ code: String) -> String {
    String(code.lowercased().prefix { $0 != "-" && $0 != "_" })
  }
}

/// Read a little slower than normal, so the test isn't one of catching fast speech. A stored clip
/// plays as it is; without one, the tap asks for it.
private struct ListeningMessage: View {
  let question: LevelTest.Question
  let language: String
  let owner: AnyHashable

  @Environment(VoiceServices.self) private var voice
  @State private var played = false

  var body: some View {
    let state = voice.player.state(for: owner)
    let isWaiting = question.audioPending

    VStack(alignment: .leading, spacing: 12) {
      // Both stay laid out, so the panel keeps its size when the clip arrives.
      ZStack {
        playRow(state)
          .frame(maxWidth: .infinity, alignment: .leading)
          .opacity(isWaiting ? 0 : 1)
          .allowsHitTesting(!isWaiting)
          .accessibilityHidden(isWaiting)

        waitingNote
          .opacity(isWaiting ? 1 : 0)
          .accessibilityHidden(!isWaiting)
      }

      if case .failed(let limit) = state {
        ListeningFailedNote(limit: limit, play: play)
      }
    }
    .padding(.vertical)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background {
      if isWaiting {
        MediaPendingFill()
      }
    }
    .background(.background, in: .rect(cornerRadius: 16))
    .clipShape(.rect(cornerRadius: 16))
    .announcesStatus(failure(state))
    .onDisappear { voice.player.stop(owner: owner) }
  }

  private func playRow(_ state: SpeechPlayer.State) -> some View {
    HStack(spacing: 12) {
      Button {
        if state == .loading || state == .playing {
          voice.player.stop(owner: owner)
        } else {
          play()
        }
      } label: {
        Label {
          if state == .loading || state == .playing {
            Text(
              "Stop the message", tableName: "Onboarding",
              comment: "Stops a listening question's message while it loads or plays")
          } else if played {
            Text(
              "Play the message again", tableName: "Onboarding",
              comment: "Plays a listening question's message again")
          } else {
            Text(
              "Play the message", tableName: "Onboarding",
              comment: "Plays a listening question's message")
          }
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
      .buttonStyle(.mainAction)
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
          .accessibilityHidden(true)
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }

  private var waitingNote: some View {
    VStack(spacing: 8) {
      Image(systemName: "headphones")
        .accessibilityHidden(true)

      Text(
        "The voice message is on its way…", tableName: "Onboarding",
        comment: "While a level test listening question's recording is still being made")
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }

  private func failure(_ state: SpeechPlayer.State) -> String? {
    guard case .failed(let limit) = state else {
      return nil
    }

    return limit?.words().said ?? ListeningFailedNote.audioDidntPlay
  }

  private func play() {
    played = true

    Task {
      await voice.player.play(
        .word(question.passage, recording: question.audio?.url, language: language), rate: 0.9,
        owner: owner, fallback: (question.passage, language))
    }
  }
}

/// Why a listening question's message didn't play, and Try again. The gate takes Try again's place
/// until its day has come, then Try again takes it back, in the room the gate had: the answers sit
/// under it.
struct ListeningFailedNote: View {
  static var audioDidntPlay: String {
    String(
      localized: "The audio didn't play.", table: "Onboarding",
      comment: "A level test listening question's message failed to play")
  }

  let limit: HelpLimit?
  let play: () -> Void

  var body: some View {
    OpeningClock(availableAt: limit?.availableAt) { now in
      note(now)
    }
  }

  private func note(_ now: Date) -> some View {
    HeldSlot(gated: limit.map { !$0.isOpen(at: now) } ?? false) {
      VStack(alignment: .leading, spacing: 8) {
        if let limit {
          if !limit.isOpen(at: now) {
            LimitNotice(limit: limit)
          }
        } else {
          Text(Self.audioDidntPlay)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        if limit?.letsTry(at: now) ?? true {
          Button(action: play) {
            Label {
              Text(
                "Try again", tableName: "Onboarding",
                comment: "Plays a level test listening question's message again after it failed")
            } icon: {
              Image(systemName: "arrow.counterclockwise")
            }
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }
      }
    }
  }
}
