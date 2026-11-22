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
  /// A microphone that's off hands over to the screen's other way to answer; without one, the bar
  /// says how to turn it on and the screen's other way on (Skip) stays.
  var onBlocked: (() -> Void)?
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
    .recordsInBar(
      bar, recorder: recorder, isChecking: checking, note: note, canRecord: !isOff
    ) {
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

  private var isOff: Bool {
    recorder.isDenied && onBlocked == nil
  }

  private var note: RecordNote? {
    if isOff {
      return .microphoneOff(
        String(
          localized: "Turn on the microphone for Zoonk in Settings to answer out loud.",
          table: "Voice", comment: "How to turn the microphone back on to record a spoken answer"))
    }

    if recorder.isRecording {
      return .recording
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
