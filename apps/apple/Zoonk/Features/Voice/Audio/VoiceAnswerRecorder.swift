import SwiftUI

/// Records an answer from the screen's bottom bar: Record is the bar's main action and the line
/// about it (`RecordNote`) sits right over it, so the step draws only a limit here.
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
  var onCheckingChanged: ((Bool) -> Void)?

  private enum Issue: Equatable {
    case noSpeech
    case failed
    case limit(HelpLimit)
  }

  var body: some View {
    VStack(alignment: .leading) {
      if case .limit(let limit) = issue, !recorder.isRecording {
        LimitNotice(limit: limit)
      }
    }
    // Record stays when the microphone is off, so it works once the learner turns it on.
    .recordsInBar(bar, recorder: recorder, isChecking: checking, note: note) {
      Task { await record() }
    }
    .announcesStatus(announcement)
    .onChange(of: checking) { _, value in onCheckingChanged?(value) }
    .onDisappear {
      recorder.cancel()
      grading?.cancel()
    }
    .slowCheck(checking, isSlow: $isSlow)
  }

  private var note: RecordNote? {
    if recorder.isDenied {
      return .microphoneOff(
        String(
          localized: "Allow the microphone in Settings, then tap Record.",
          table: "Voice",
          comment:
            "The learner refused the microphone for the app. “Record” is the label of the button that starts the recording."
        ))
    }

    if let active = RecordNote(active: recorder.status) {
      return active
    }

    if recorder.isUnavailable {
      return .microphoneUnavailable
    }

    if checking {
      return isSlow ? .slow : nil
    }

    switch issue {
    case .noSpeech: return .noSpeech
    case .failed: return .failed
    case .limit: return nil
    case nil: return .ready
    }
  }

  /// Silent while recording: VoiceOver's speech would end up in the take.
  private var announcement: String? {
    guard !recorder.isRecording, case .limit(let limit) = issue else {
      return nil
    }

    return limit.words().said
  }

  private func record() async {
    issue = nil

    await recorder.start { recording in
      grading = Task { await check(recording) }
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
}
