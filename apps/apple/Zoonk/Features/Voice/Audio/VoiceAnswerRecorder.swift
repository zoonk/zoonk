import SwiftUI

struct VoiceAnswerRecorder<Grade: Sendable>: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(RecordInBar.self) private var bar: RecordInBar?
  @State private var recorder = VoiceRecorder()
  @State private var checking = false
  @State private var isSlow = false
  @State private var grading: Task<Void, Never>?
  @State private var issue: Issue?

  let grade: @MainActor (VoiceServices, VoiceRecording) async -> GradeOutcome<Grade>
  let onGraded: @MainActor (Grade) -> Void
  /// A microphone that's off hands over to the screen's other way to answer instead of showing how
  /// to turn it on.
  var onBlocked: (() -> Void)?
  var onCheckingChanged: ((Bool) -> Void)?

  private enum Issue: Equatable {
    case noSpeech
    case failed
    case limit(HelpLimit)
  }

  var body: some View {
    if recorder.isDenied, onBlocked == nil {
      MicrophoneOffView(
        description: Text(
          "Turn on the microphone for Zoonk in Settings to answer out loud.", tableName: "Voice",
          comment: "How to turn the microphone back on to record a spoken answer")
      ) {}
    } else {
      VStack(alignment: .leading, spacing: 12) {
        if bar == nil {
          RecordButton(recorder: recorder, isDisabled: checking) {
            Task { await record() }
          }
          .controlSize(.large)
        }

        status
      }
      .recordsInBar(bar, recorder: recorder, isChecking: checking, line: line) {
        Task { await record() }
      }
      .announcesStatus(announcement)
      .onChange(of: checking) { _, value in onCheckingChanged?(value) }
      .onDisappear {
        recorder.cancel()
        grading?.cancel()
      }
      .task(id: checking) {
        isSlow = false

        if checking {
          try? await Task.sleep(for: LessonGrading.slowCheck)
          isSlow = !Task.isCancelled
        }
      }
    }
  }

  @ViewBuilder
  private var status: some View {
    if case .limit(let limit) = issue, !recorder.isRecording {
      LimitNotice(limit: limit)
    } else if bar?.showsNote != true, let hint {
      if issue == .failed, !recorder.isRecording {
        FailureLine(message: hint)
          .typeStyle(.note)
      } else {
        Text(hint)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .accessibilityAddTraits(.updatesFrequently)
      }
    }
  }

  /// The line for a bar that draws it over its Record, with the tone that reads it out as
  /// `announcement` does here.
  private var line: RecorderLine? {
    guard let hint else {
      return nil
    }

    if recorder.isRecording {
      return RecorderLine(text: hint, tone: .hint)
    }

    if checking {
      return RecorderLine(text: hint, tone: .status)
    }

    switch issue {
    case .limit: return nil
    case .noSpeech: return RecorderLine(text: hint, tone: .waiting)
    case .failed: return RecorderLine(text: hint, tone: .failure)
    case nil: return RecorderLine(text: hint, tone: .hint)
    }
  }

  /// Silent while recording: VoiceOver's speech would end up in the take.
  private var announcement: String? {
    if recorder.isRecording {
      return nil
    }

    if case .limit(let limit) = issue {
      return limit.words().said
    }

    // A failure is a `FailureLine`, which reads itself out, and a bar reads its own line.
    return bar?.showsNote != true && (checking || issue == .noSpeech) ? hint : nil
  }

  private var hint: String? {
    if recorder.isRecording {
      return String(
        localized: "Listening… Tap Stop to check.", table: "Voice",
        comment: "Shown while the learner records an answer")
    }

    if checking, isSlow {
      return String(
        localized: "Still checking. This is taking longer than usual.", table: "Voice",
        comment: "Grading a spoken answer is taking longer than usual")
    }

    if checking {
      return String(
        localized: "Checking…", table: "Voice", comment: "Shown while a spoken answer is graded")
    }

    switch issue {
    case .noSpeech:
      return String(
        localized: "We couldn't hear any words. Try again.", table: "Voice",
        comment: "A recording had no words in it")
    case .failed:
      return String(
        localized: "We couldn't check your answer this time. Try again.", table: "Voice",
        comment: "Grading a spoken answer failed")
    case .limit, nil:
      return String(
        localized: "Tap Record and say it out loud", table: "Voice",
        comment: "Asks the learner to record their answer")
    }
  }

  private func record() async {
    issue = nil

    let started = await recorder.start { recording in
      grading = Task { await check(recording) }
    }

    if !started, recorder.isDenied {
      onBlocked?()
    }
  }

  private func check(_ recording: VoiceRecording) async {
    checking = true
    defer { checking = false }

    switch await grade(voice, recording) {
    case .graded(let value):
      onGraded(value)
    case .noSpeech:
      issue = .noSpeech
    case .limit(let limit):
      issue = .limit(limit)
    case .failed:
      issue = .failed
    case .obsolete:
      break
    }
  }
}

extension VoiceServices {
  func gradeSpokenStep(
    stepId: String,
    studySessionId: String?,
    recording: VoiceRecording,
    mistake: SpokenMistakeTarget? = nil
  ) async -> GradeOutcome<Components.Schemas.SpokenAnswerGrade> {
    await grade(invalidating: [.learnerModel, .userProgress, .userSession]) { [api] token in
      try await api.answerSpokenStep(
        stepId: stepId, studySessionId: studySessionId, recording: recording, token: token,
        mistake: mistake)
    }
  }

  func gradeLevelTestSentence(
    goalId: String,
    recording: VoiceRecording
  ) async -> GradeOutcome<Components.Schemas.LanguageLevelTestSpokenResult> {
    await grade { [api] token in
      try await api.answerLevelTestOutLoud(goalId: goalId, recording: recording, token: token)
    }
  }
}
