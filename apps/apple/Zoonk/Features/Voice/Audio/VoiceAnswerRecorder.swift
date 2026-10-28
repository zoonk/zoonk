import SwiftUI

/// Records one spoken answer and has it graded: Record, Stop, then the grade goes to `onGraded`.
/// While it's checked the button waits; a recording with no words, a failed check or a used-up
/// limit is explained under it, and Record tries again. Used by the lesson's spoken screens and the
/// level test's sentence; the host draws the verdict.
struct VoiceAnswerRecorder<Grade: Sendable>: View {
  @Environment(VoiceServices.self) private var voice
  @State private var recorder = VoiceRecorder()
  @State private var checking = false
  @State private var issue: Issue?

  let grade: @MainActor (VoiceServices, VoiceRecording) async throws -> Grade
  let onGraded: @MainActor (Grade) -> Void
  var onAccount: (() -> Void)?
  var onPlus: (() -> Void)?
  /// Says "Tap and say it out loud" while idle; off where the screen already asks.
  var asksToSpeak = true

  private enum Issue: Equatable {
    case noSpeech
    case failed
    case limit(HelpLimit)
  }

  var body: some View {
    if recorder.isDenied {
      MicrophoneOffView(
        description: Text(
          "Turn on the microphone for Zoonk in Settings to answer out loud.", tableName: "Voice",
          comment: "How to turn the microphone back on to record a spoken answer")
      ) {}
    } else {
      VStack(alignment: .leading, spacing: 12) {
        RecordButton(recorder: recorder, isDisabled: checking) {
          Task { await record() }
        }

        status
      }
      .onDisappear { recorder.cancel() }
    }
  }

  @ViewBuilder
  private var status: some View {
    if case .limit(let limit) = issue, !recorder.isRecording {
      HelpLimitNotice(limit: limit, onAccount: onAccount, onPlus: onPlus)
    } else if let hint {
      Text(hint)
        .font(.subheadline)
        .foregroundStyle(issue == .failed && !recorder.isRecording ? .destructive : .secondary)
        .accessibilityAddTraits(.updatesFrequently)
    }
  }

  private var hint: String? {
    if recorder.isRecording {
      return String(
        localized: "Listening… Tap Stop to check.", table: "Voice",
        comment: "Shown while the learner records an answer")
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
      return asksToSpeak
        ? String(
          localized: "Tap and say it out loud", table: "Voice",
          comment: "Asks the learner to record their answer")
        : nil
    }
  }

  private func record() async {
    issue = nil

    await recorder.start { recording in
      Task { await check(recording) }
    }
  }

  private func check(_ recording: VoiceRecording) async {
    checking = true
    defer { checking = false }

    do {
      onGraded(try await grade(voice, recording))
    } catch is CancellationError {
      return
    } catch let refusal as VoiceRefusal where refusal.isNoSpeech {
      issue = .noSpeech
    } catch let refusal as VoiceRefusal {
      issue = refusal.limit.map(Issue.limit) ?? .failed
    } catch {
      issue = .failed
    }
  }
}

extension VoiceServices {
  /// Grades a lesson's spoken screen. What the learner says feeds their pronunciation reviews, so
  /// the learner model changes.
  func gradeSpokenStep(
    stepId: String,
    studySessionId: String?,
    recording: VoiceRecording
  ) async throws -> Components.Schemas.SpokenAnswerGrade {
    let api = api
    let grade = try await perform { token in
      try await api.answerSpokenStep(
        stepId: stepId, studySessionId: studySessionId, recording: recording, token: token)
    }

    cache.invalidate([.learnerModel])
    return grade
  }

  /// Grades the level test's sentence said out loud; the test's next step comes with it.
  func gradeLevelTestSentence(
    goalId: String,
    recording: VoiceRecording
  ) async throws -> Components.Schemas.LanguageLevelTestSpokenResult {
    let api = api

    return try await perform { token in
      try await api.answerLevelTestOutLoud(goalId: goalId, recording: recording, token: token)
    }
  }
}
