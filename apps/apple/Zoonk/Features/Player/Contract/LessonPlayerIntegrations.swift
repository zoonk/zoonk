import AVFoundation
import SwiftUI

// Each seam has a working default, so the player plays without the feature that owns it.

struct LessonAudio: Sendable {
  let play: @MainActor @Sendable (URL) async -> Void
  /// Only on a tap. Without it, text without a recording has no sound button.
  let speak: (@MainActor @Sendable (_ text: String, _ language: String) async -> Void)?

  static let system = LessonAudio(
    play: { url in SystemAudioPlayer.shared.play(url) },
    speak: nil)
}

@MainActor
private final class SystemAudioPlayer {
  static let shared = SystemAudioPlayer()
  private var player: AVPlayer?

  func play(_ url: URL) {
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    let player = AVPlayer(url: url)
    self.player = player
    player.play()
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
