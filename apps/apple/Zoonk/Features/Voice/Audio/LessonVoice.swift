import SwiftUI

/// A clip that has to be voiced plays only on the learner's tap.
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

private let lessonSound = "lesson"

private struct SpokenStepRecorder: View {
  let context: SpokenAnswerContext

  var body: some View {
    if !context.isLocked {
      VoiceAnswerRecorder(
        grade: { voice, recording in
          await voice.gradeSpokenStep(
            stepId: context.stepId, studySessionId: context.studySessionId, recording: recording)
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
