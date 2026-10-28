import SwiftUI

/// The voice feature's part of the lesson player, set once at the app root: a lesson's recordings
/// and clips play through the app's one player (a clip only on the learner's tap), and spoken
/// screens record and grade out loud.
extension LessonAudio {
  static func voice(_ voice: VoiceServices) -> LessonAudio {
    LessonAudio(
      play: { url in await voice.player.play(.recording(url), owner: lessonSound) },
      speak: { text, language in
        await voice.player.play(.text(text, language: language), owner: lessonSound)
      })
  }
}

extension SpokenAnswerRecording {
  static let voice = SpokenAnswerRecording { context in
    AnyView(SpokenStepRecorder(context: context))
  }
}

/// Whose sound a lesson plays: one at a time, like every screen's.
private let lessonSound = "lesson"

/// Records a spoken screen's sentence and grades it (`createSpokenAnswer`); the player shows the
/// verdict. An answered screen shows no recorder.
private struct SpokenStepRecorder: View {
  let context: SpokenAnswerContext

  var body: some View {
    if !context.isLocked {
      VoiceAnswerRecorder(
        grade: { voice, recording in
          await voice.gradeSpokenStep(
            stepId: context.stepId, studySessionId: nil, recording: recording)
        },
        onGraded: { grade in
          context.onGraded(
            SpokenAnswerVerdict(
              isCorrect: grade.isCorrect, score: grade.score, transcript: grade.transcript,
              feedback: grade.explanation, wordsToPractice: grade.wordsToPractice.map(\.text)))
        },
        asksToSpeak: false,
        onBlocked: context.onBlocked)
    }
  }
}
