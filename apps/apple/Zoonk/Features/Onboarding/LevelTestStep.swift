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

/// A listening message plays a little slower than normal, so the test isn't one of catching fast
/// speech.
let levelTestListeningRate: Float = 0.9

/// How long a message takes to hear, in whole seconds: its clip's length at the slower rate. One
/// length before, during and after a play.
func heardSeconds(clip seconds: TimeInterval) -> Int {
  Int((seconds / Double(levelTestListeningRate)).rounded())
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

    // Every way the question ends silences its message at the press, before the save.
    let silenced = { (action: @escaping () -> Void) in
      {
        voice.player.stop(owner: owner)
        action()
      }
    }

    return PlacementQuestionScreen(
      subject: languageSkillName(question.skill.rawValue), number: number, total: total,
      groups: levelTestGroups(total: total), question: shown,
      second: isListening ? listeningAction(skips: skips, deferAudio: silenced(onDeferAudio)) : nil,
      isSaving: isSaving, failures: failures, context: context,
      onReport: onReport,
      onAnswer: { answer in silenced { onAnswer(answer, skips) }() },
      onStop: canStop ? silenced(onStop) : nil,
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
  private func listeningAction(skips: Bool, deferAudio: @escaping () -> Void)
    -> QuestionSecondAction
  {
    let label = Self.listeningLabel(skips: skips, heard: heard)

    return QuestionSecondAction(
      label: label, steadyAmong: Self.listeningLabels,
      action: label == TestCopy.cantListen ? deferAudio : nil)
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
      .resultLinkRow()
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
  /// The clip's length once a play knew it, for a message whose length wasn't known before.
  @State private var length: TimeInterval?

  var body: some View {
    let state = voice.player.state(for: owner)
    let isWaiting = question.audioPending

    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        OpeningClock(availableAt: failedLimit(state)?.availableAt) { now in
          playButton(state, isWaiting: isWaiting, retries: retries(state, at: now))
        }

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
        ListeningFailedNote(limit: limit)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .announcesStatus(failure(state))
    .onDisappear { voice.player.stop(owner: owner) }
  }

  /// The line fills as the message plays; its length stays the time it takes to hear.
  private func progress(_ playback: (elapsed: TimeInterval, length: TimeInterval)?) -> some View {
    let clip = question.audio?.durationMs.map { Double($0) / 1000 } ?? length ?? playback?.length
    let playing = playback?.length ?? clip

    return HStack(spacing: 12) {
      Meter(
        value: playing.map { $0 > 0 ? (playback?.elapsed ?? 0) / $0 : 0 } ?? 0,
        fill: Color(.foreground), height: 4)

      // The length's room is kept while it isn't known, so the line doesn't move when it is.
      Text(verbatim: PlanDate.clock(seconds: clip.map { heardSeconds(clip: $0) } ?? 0))
        .typeStyle(.data)
        .monospacedDigit()
        .foregroundStyle(.mutedForeground)
        .opacity(clip == nil ? 0 : 1)
    }
    .accessibilityHidden(true)
    .onChange(of: playback?.length) { _, known in
      if length == nil, let known {
        length = known
      }
    }
  }

  private func failedLimit(_ state: SpeechPlayer.State) -> HelpLimit? {
    if case .failed(let limit) = state { limit } else { nil }
  }

  /// A failed play the learner can try again turns the row's button into the retry.
  private func retries(_ state: SpeechPlayer.State, at now: Date) -> Bool {
    guard case .failed(let limit) = state else { return false }
    return limit?.letsTry(at: now) ?? true
  }

  private func playButton(_ state: SpeechPlayer.State, isWaiting: Bool, retries: Bool)
    -> some View
  {
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
        } else if retries {
          Text(
            "Try again", tableName: "Onboarding",
            comment: "Plays a level test listening question's message again after it failed")
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
        } else if retries {
          Image(systemName: "arrow.counterclockwise")
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
        rate: levelTestListeningRate, owner: owner, fallback: (question.passage, language))

      if let heard {
        length = heard
        onHeard()
      }
    }
  }
}

/// Why a listening question's message didn't play; the row's own button is its retry. A limit a
/// retry can't lift yet says so in the same room until its time comes.
struct ListeningFailedNote: View {
  static var audioDidntPlay: String {
    String(
      localized: "The audio didn't play.", table: "Onboarding",
      comment: "A level test listening question's message failed to play")
  }

  let limit: HelpLimit?

  var body: some View {
    OpeningClock(availableAt: limit?.availableAt) { now in
      HeldSlot(gated: limit.map { !$0.isOpen(at: now) } ?? false) {
        if let limit, !limit.isOpen(at: now) {
          LimitNotice(limit: limit)
        } else {
          Text(Self.audioDidntPlay)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
  }
}
