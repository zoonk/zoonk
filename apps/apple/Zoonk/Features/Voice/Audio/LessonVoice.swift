import SwiftUI

/// A clip that has to be voiced plays only on the learner's tap.
extension LessonAudio {
  static func voice(_ voice: VoiceServices) -> LessonAudio {
    LessonAudio(
      play: { url, rate, owner in
        await voice.player.play(.recording(url), rate: rate, owner: owner)
      },
      speak: { text, language, recording, rate, owner in
        await voice.player.play(
          .word(text, recording: recording, language: language), rate: rate, owner: owner,
          fallback: recording == nil ? nil : (text, language))
      },
      stop: { owner in voice.player.stop(owner: owner) })
  }
}

extension SpokenAnswerRecording {
  static let voice = SpokenAnswerRecording { context in
    AnyView(SpokenStepRecorder(context: context))
  }
}

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
              feedback: grade.explanation, heard: SpokenHeard(grade)))
        },
        asksToSpeak: false,
        onBlocked: context.onBlocked)
    }
  }
}

extension SpokenHeard {
  init(_ grade: Components.Schemas.SpokenAnswerGrade) {
    self.init(
      words: grade.words.map {
        Word(
          text: $0.text, status: Word.Status(rawValue: $0.status.rawValue) ?? .missed,
          heard: $0.heard)
      },
      wordsToPractice: grade.wordsToPractice.map {
        PracticeWord(text: $0.text, audioUrl: $0.audioUrl, respelling: $0.respelling, tip: $0.tip)
      })
  }
}
