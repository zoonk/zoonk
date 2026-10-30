import AVFoundation
import SwiftUI

// Each seam has a working default, so the player plays without the feature that owns it.

/// A lesson screen gives its sounds its own owner (`owned(by:)`), so leaving it stops only them.
/// `play` and `speak` return once the sound has played or was stopped.
struct LessonAudio: Sendable {
  private var owner = "lesson"
  private let playing: @MainActor @Sendable (URL, _ rate: Float, _ owner: String) async -> Void
  private let speaking:
    (
      @MainActor @Sendable (
        _ text: String, _ language: String, _ recording: URL?, _ rate: Float, _ owner: String
      ) async -> Void
    )?
  private let stopping: @MainActor @Sendable (_ owner: String) -> Void

  init(
    play: @escaping @MainActor @Sendable (URL, _ rate: Float, _ owner: String) async -> Void,
    speak: (
      @MainActor @Sendable (
        _ text: String, _ language: String, _ recording: URL?, _ rate: Float, _ owner: String
      ) async -> Void
    )?,
    stop: @escaping @MainActor @Sendable (_ owner: String) -> Void
  ) {
    playing = play
    speaking = speak
    stopping = stop
  }

  /// Slow enough to hear each sound, close enough to real speech to still sound like the word.
  static let slowRate: Float = 0.7

  /// Starts a recording and returns at once.
  static let system = LessonAudio(
    play: { url, rate, _ in SystemAudioPlayer.shared.play(url, rate: rate) },
    speak: nil,
    stop: { _ in SystemAudioPlayer.shared.stop() })

  /// Only on a tap. Reads text aloud, or plays its recording when it has one, reading the text when
  /// the recording won't play. Without it, text without a recording has no sound button.
  var speak:
    (
      @MainActor @Sendable (_ text: String, _ language: String, _ recording: URL?, _ rate: Float)
        async -> Void
    )?
  {
    guard let speaking else {
      return nil
    }

    let owner = owner
    return { text, language, recording, rate in
      await speaking(text, language, recording, rate, owner)
    }
  }

  @MainActor
  func play(_ url: URL, rate: Float = 1) async {
    await playing(url, rate, owner)
  }

  /// A sound still loading never starts.
  @MainActor
  func stop() {
    stopping(owner)
  }

  func owned(by owner: String) -> LessonAudio {
    var audio = self
    audio.owner = owner
    return audio
  }
}

@MainActor
private final class SystemAudioPlayer {
  static let shared = SystemAudioPlayer()
  private var player: AVPlayer?

  func play(_ url: URL, rate: Float) {
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    let player = AVPlayer(url: url)
    self.player = player
    player.playImmediately(atRate: rate)
  }

  func stop() {
    player?.pause()
    player = nil
  }
}

struct SpokenAnswerVerdict: Hashable, Sendable {
  let isCorrect: Bool
  /// Partial credit from 0 to 1.
  let score: Double?
  let transcript: String
  let feedback: String?
  let wordsToPractice: [String]
}

struct SpokenAnswerContext {
  let lessonId: String
  let studySessionId: String?
  let stepId: String
  let content: SpokenAnswerContent
  let isLocked: Bool
  let onGraded: @MainActor (SpokenAnswerVerdict) -> Void
  /// The microphone is off for the app: the screen offers typing instead.
  let onBlocked: @MainActor () -> Void
}

/// Records spoken answers. Without a recorder (`input` nil), spoken screens take a typed answer,
/// and "I can't talk now" plays their listening exercise.
struct SpokenAnswerRecording: Sendable {
  let input: (@MainActor @Sendable (SpokenAnswerContext) -> AnyView)?

  static let typed = SpokenAnswerRecording(input: nil)
}

struct LessonTutorScope: Hashable, Sendable {
  let lessonId: String
  let stepId: String?
  /// From 1.
  var stepNumber: Int?
  /// The learner's answer to the screen in view, once its result shows.
  var answer: LessonAnswer?
  /// The lesson's screens, for a question about the whole lesson.
  var stepIds: [String] = []
  let suggestions: [Components.Schemas.LessonTutorSuggestion]
  /// The suggestion to have ready to send (`simpler` when the learner seems stuck), if any.
  var startingSuggestionId: String?
}

struct LessonTutor: Sendable {
  /// Without it, the player has no Ask button.
  let panel: (@MainActor @Sendable (LessonTutorScope, _ isBeside: Bool) -> AnyView)?

  static let unavailable = LessonTutor(panel: nil)
}

/// A public lesson's screens need a session. Without it, a visitor is asked to log in.
struct LessonGuestStart: Sendable {
  let start: (@MainActor @Sendable () async -> Bool)?

  static let unavailable = LessonGuestStart(start: nil)
}

extension EnvironmentValues {
  @Entry var lessonAudio: LessonAudio = .system
  @Entry var spokenAnswerRecording: SpokenAnswerRecording = .typed
  @Entry var lessonTutor: LessonTutor = .unavailable
  @Entry var lessonGuestStart: LessonGuestStart = .unavailable
}
