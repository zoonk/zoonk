import AVFoundation
import SwiftUI

// The player's seams for other features. Each has a working default, so the player plays without
// them; the owning feature sets its value once at the app root with `.environment(\.<key>, …)`.

// MARK: - Sound (voice feature)

/// Plays a lesson's sounds: a word's or sentence's recording, or a clip asked for on a tap.
struct LessonAudio: Sendable {
  /// Plays a recording.
  let play: @MainActor @Sendable (URL) async -> Void
  /// Asks for a clip of text that has no recording (`POST /v1/speech-clips`, on a tap only) and
  /// plays it. Without it, text without a recording has no sound button.
  let speak: (@MainActor @Sendable (_ text: String, _ language: String) async -> Void)?

  /// Plays recordings with the system player; no clips are asked for.
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

/// How a recording of a spoken answer came out, as `POST /v1/steps/{stepId}/spoken-answers` grades it.
struct SpokenAnswerVerdict: Hashable, Sendable {
  let isCorrect: Bool
  /// Partial credit from 0 to 1.
  let score: Double?
  /// What was heard.
  let transcript: String
  /// The grader's explanation.
  let feedback: String?
  /// Words to say again.
  let wordsToPractice: [String]
}

/// What the recorder of a spoken screen gets. It records, uploads and grades, explains its own
/// refusals (nothing heard, a limit reached), and reports the verdict.
struct SpokenAnswerContext {
  let lessonId: String
  let stepId: String
  let content: SpokenAnswerContent
  /// The screen was answered: the recorder shows no control.
  let isLocked: Bool
  let onGraded: @MainActor (SpokenAnswerVerdict) -> Void
}

/// Records spoken answers. Without a recorder (`input` nil), spoken screens take a typed answer,
/// and "I can't talk now" plays their listening exercise.
struct SpokenAnswerRecording: Sendable {
  let input: (@MainActor @Sendable (SpokenAnswerContext) -> AnyView)?

  static let typed = SpokenAnswerRecording(input: nil)
}

// MARK: - Ask (tutor feature)

/// The lesson's "Ask" panel: a thread of questions about the lesson, opened on a screen.
struct LessonTutorScope: Hashable, Sendable {
  let lessonId: String
  /// The screen in view when the panel opened.
  let stepId: String?
  /// Questions worded in the lesson's language ("Explain it more simply", …).
  let suggestions: [Components.Schemas.LessonTutorSuggestion]
}

struct LessonTutor: Sendable {
  /// The panel's content, shown in an inspector (a sheet on compact widths). Without it, the
  /// player has no Ask button.
  let panel: (@MainActor @Sendable (LessonTutorScope) -> AnyView)?

  static let unavailable = LessonTutor(panel: nil)
}

// MARK: - Guests (onboarding feature)

/// Signs a visitor in as a guest, so a public lesson's screens load (they need a session).
/// Returns whether a guest session started. Without it, a visitor is asked to log in.
struct LessonGuestStart: Sendable {
  let start: (@MainActor @Sendable () async -> Bool)?

  static let unavailable = LessonGuestStart(start: nil)
}

// MARK: - After a lesson (data layer)

/// What finished: the app's cached learner facts (summary, Today, progress, the chapter) are out
/// of date.
struct LessonCompletionEvent: Hashable, Sendable {
  let lessonId: String
  let studySessionId: String?
  let isFirstCompletion: Bool
}

/// Called once a lesson's completion is saved, to refresh what it changed.
struct LessonCompletionHook: Sendable {
  let lessonCompleted: @MainActor @Sendable (LessonCompletionEvent) -> Void

  static let none = LessonCompletionHook(lessonCompleted: { _ in })

  /// Refreshes what a finished lesson changed, as main revalidates after `completeLibraryLesson`:
  /// the learner's progress (the summary, Today, statistics, chapters) and their learner model.
  static func invalidating(_ cache: AppCache) -> LessonCompletionHook {
    LessonCompletionHook { _ in cache.invalidate([.userProgress, .learnerModel]) }
  }
}

extension EnvironmentValues {
  @Entry var lessonAudio: LessonAudio = .system
  @Entry var spokenAnswerRecording: SpokenAnswerRecording = .typed
  @Entry var lessonTutor: LessonTutor = .unavailable
  @Entry var lessonGuestStart: LessonGuestStart = .unavailable
  @Entry var lessonCompletionHook: LessonCompletionHook = .none
}
