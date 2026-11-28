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
    shown.audioUnconfirmed = true
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

/// Main's `toLevelTestGroups`: a level test's sections in order, reading, listening and the check,
/// as `LEVEL_TEST_BLOCK_SIZE` questions each up to its ceiling.
func levelTestGroups(total: Int) -> [Int] {
  let block = 4
  let reading = min(block, total)
  let listening = min(block, total - reading)
  return [reading, listening, total - reading - listening].filter { $0 > 0 }
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
  /// "Can't listen now", until the message has played to its end once.
  let onDeferAudio: () -> Void
  let onStop: () -> Void

  @Environment(VoiceServices.self) private var voice
  /// The player is app-wide, and another window can show the same bank question.
  @State private var audioOwner = UUID()
  /// The message played to its end once: not understanding it is an answer now.
  @State private var heard = false

  var body: some View {
    let isListening = question.skill == .listening
    let owner = AnyHashable([audioOwner.uuidString, question.id])
    let audioFailed = if case .failed = voice.player.state(for: owner) { true } else { false }
    let skips = isListening && Self.skips(question, audioFailed: audioFailed, heard: heard)
    var shown = PracticeQuestion(
      itemId: question.id, format: .multipleChoice, question: question.question,
      options: question.options, select: selectsAll ? .all : .one)
    shown.context = isListening ? nil : question.passage

    return PlacementQuestionScreen(
      subject: languageSkillName(question.skill.rawValue), number: number, total: total,
      groups: levelTestGroups(total: total), question: shown,
      second: isListening ? listeningAction(skips: skips) : nil,
      isSaving: isSaving, failures: failures, context: context,
      onReport: onReport,
      onAnswer: { onAnswer($0, skips) },
      onStop: canStop ? onStop : nil,
      media: {
        if isListening {
          ListeningMessage(question: question, language: targetLanguage, owner: owner) {
            heard = true
          }
        }
      })
  }

  /// "Can't listen now" ends the test's listening until the message has played to its end once;
  /// after, "I didn't understand" is the answer. A message that can't play yet is skipped.
  private func listeningAction(skips: Bool) -> QuestionSecondAction {
    let label = Self.listeningLabel(skips: skips, heard: heard)

    return QuestionSecondAction(
      label: label, steadyAmong: Self.listeningLabels,
      action: label == TestCopy.cantListen ? onDeferAudio : nil)
  }

  /// A message the learner can't hear yet is skipped, this question only: answering it would move
  /// their level, and ending the test's listening is for a learner who chose not to listen.
  static func skips(_ question: LevelTest.Question, audioFailed: Bool, heard: Bool) -> Bool {
    question.audioPending || audioFailed || (question.audioUnconfirmed && !heard)
  }

  static let skipQuestion = LocalizedStringResource("Skip this question", table: "Onboarding")
  static let didntUnderstand = LocalizedStringResource(
    "I didn't understand", table: "Onboarding",
    comment:
      "Button on a listening question, after the learner played the message: they heard it and didn't understand it."
  )
  static let listeningLabels = [TestCopy.cantListen, didntUnderstand, skipQuestion]

  static func listeningLabel(skips: Bool, heard: Bool) -> LocalizedStringResource {
    skips ? skipQuestion : heard ? didntUnderstand : TestCopy.cantListen
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

/// A listening question's message: play, a line that fills as it plays, and its length, which
/// counts down while it plays. It reads a little slower than normal, so the test isn't one of
/// catching fast speech. A stored clip plays as it is; without one, the tap asks for it.
private struct ListeningMessage: View {
  let question: LevelTest.Question
  let language: String
  let owner: AnyHashable
  /// The message played to its end.
  let onHeard: () -> Void

  @Environment(VoiceServices.self) private var voice
  @State private var played = false
  /// The clip's length once it played, for a message whose length wasn't known before.
  @State private var length: TimeInterval?

  private static let rate: Float = 0.9

  var body: some View {
    let state = voice.player.state(for: owner)
    let isWaiting = question.audioPending

    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        playButton(state, isWaiting: isWaiting)

        // The row keeps its size when the clip arrives.
        if isWaiting {
          Text(
            "The voice message is on its way…", tableName: "Onboarding",
            comment: "While a level test listening question's recording is still being made"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .frame(maxWidth: .infinity, alignment: .leading)
        } else {
          TimelineView(.animation(minimumInterval: 0.1, paused: state != .playing)) { _ in
            progress(voice.player.playback(for: owner))
          }
        }
      }
      .frame(minHeight: 44)

      if case .failed(let limit) = state {
        ListeningFailedNote(limit: limit, play: play)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .announcesStatus(failure(state))
    .onDisappear { voice.player.stop(owner: owner) }
  }

  private func progress(_ playback: (elapsed: TimeInterval, length: TimeInterval)?) -> some View {
    let total = playback?.length ?? length ?? question.audio?.durationMs.map { Double($0) / 1000 }
    let elapsed = playback?.elapsed ?? 0

    return HStack(spacing: 12) {
      Meter(
        value: total.map { $0 > 0 ? elapsed / $0 : 0 } ?? 0, fill: Color(.foreground), height: 4)

      if let total {
        Text(
          verbatim: PlanDate.clock(seconds: Int(((total - elapsed) / Double(Self.rate)).rounded()))
        )
        .typeStyle(.data)
        .monospacedDigit()
        .foregroundStyle(.mutedForeground)
      }
    }
    .accessibilityHidden(true)
  }

  private func playButton(_ state: SpeechPlayer.State, isWaiting: Bool) -> some View {
    Button {
      if state == .loading || state == .playing {
        voice.player.stop(owner: owner)
      } else {
        play()
      }
    } label: {
      Label {
        if isWaiting {
          Text(
            "The voice message is on its way…", tableName: "Onboarding",
            comment: "While a level test listening question's recording is still being made")
        } else if state == .loading || state == .playing {
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
        if isWaiting || state == .loading {
          ProgressView()
            .controlSize(.small)
        } else {
          Image(systemName: state == .playing ? "stop.fill" : "play.fill")
        }
      }
      .labelStyle(.iconOnly)
    }
    .buttonStyle(.mainAction.icon)
    .controlSize(.large)
    .disabled(isWaiting)
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
      let heard = await voice.player.play(
        .word(question.passage, recording: question.audio?.url, language: language),
        rate: Self.rate, owner: owner, fallback: (question.passage, language))

      if let heard {
        length = heard
        onHeard()
      }
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
