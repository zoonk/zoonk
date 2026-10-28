import SwiftUI

/// One screen of the lesson with its action bar pinned at the bottom: the verdict, then the one
/// next action (Check, Continue, ...), with Previous on every screen after the first.
struct LessonStageView: View {
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.lessonAudio) private var audio
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let store: LessonPlayerStore
  let state: LessonPlayerState

  var body: some View {
    if let step = state.currentStep {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          if state.notice == .answerNotSaved {
            Label {
              Text(
                "Your answer didn't reach us. Answer this screen again to finish.",
                tableName: "Player",
                comment: "The lesson came back to a screen whose answer was never saved")
            } icon: {
              Image(systemName: "exclamationmark.arrow.circlepath")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
          }

          LessonStepView(step: step, state: state, store: store)
        }
        .frame(maxWidth: 680, alignment: .leading)
        .frame(maxWidth: .infinity)
        .scenePadding()
      }
      .id(step.id)
      .scrollDismissesKeyboard(.interactively)
      .safeAreaBar(edge: .bottom) {
        LessonActionBar(store: store, state: state, step: step)
      }
      .sensoryFeedback(trigger: state.currentResult?.isCorrect) { _, isCorrect in
        isCorrect.map { $0 ? .success : .error }
      }
      .onChange(of: state.currentResult?.isCorrect) { _, isCorrect in
        if isCorrect == true, store.soundsEnabled, !state.reviewing {
          LessonSounds.shared.play(.correct)
        }
      }
    }
  }
}

/// The task's action bar: the verdict when there is one, Previous, and the one next action.
/// Return does what the main button says, as on main.
struct LessonActionBar: View {
  let store: LessonPlayerStore
  let state: LessonPlayerState
  let step: LessonStep

  @Environment(\.activityRenderers) private var activityRenderers

  var body: some View {
    VStack(spacing: 12) {
      if let result = state.currentResult, state.phase == .feedback, !step.showsOwnResult {
        LessonVerdictView(step: step, result: result, store: store, willReturn: willReturn)
      }

      if state.notice == .selfCorrect {
        Label {
          Text(
            "Not quite. Fix it and check again.", tableName: "Player",
            comment: "A wrong language answer the learner can fix once")
        } icon: {
          Image(systemName: "arrow.uturn.backward")
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.pink)
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      if state.checkFailed {
        Text(
          "We couldn't check your answer this time. Try again.", tableName: "Player",
          comment: "The server couldn't grade a written or spoken answer"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      HStack(spacing: 12) {
        if state.canGoBack {
          Button {
            store.goBack()
          } label: {
            Label {
              Text(
                "Previous screen", tableName: "Player",
                comment: "Goes back one screen in the lesson")
            } icon: {
              Image(systemName: "chevron.left")
            }
            .labelStyle(.iconOnly)
            .frame(minHeight: 32)
          }
          .buttonStyle(.bordered)
          .tint(.primary)
          .buttonBorderShape(.circle)
          .controlSize(.large)
          .keyboardShortcut(.leftArrow, modifiers: [])
        }

        primaryButton
      }
    }
    .frame(maxWidth: 680)
    .frame(maxWidth: .infinity)
    .scenePadding()
  }

  @ViewBuilder
  private var primaryButton: some View {
    let primary = primaryAction

    Button {
      switch primary.action {
      case .check:
        Task { await store.check(gradeActivity: activityGrade) }
      case .continueLesson:
        store.continueLesson()
      }
    } label: {
      HStack {
        if primary.isBusy {
          ProgressView()
        }

        Text(primary.title)
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.glassProminent)
    .tint(.primary)
    .controlSize(.extraLarge)
    .disabled(primary.isDisabled)
    .keyboardShortcut(.defaultAction)
  }

  private var activityGrade: ((ActivityStepContent, ActivityAnswer) -> Bool)? {
    guard case .activity(let content) = step.content else {
      return nil
    }

    return activityRenderers.renderer(for: content.template)?.grade
  }

  /// A missed check or activity comes back at the end of the lesson.
  private var willReturn: Bool {
    state.queue.lastIndex(of: step.id).map { $0 > state.position } ?? false
  }

  private enum PrimaryKind {
    case check, continueLesson
  }

  private struct PrimaryAction {
    let action: PrimaryKind
    let title: LocalizedStringResource
    var isBusy = false
    var isDisabled = false
  }

  private var primaryAction: PrimaryAction {
    switch state.phase {
    case .feedback:
      return PrimaryAction(action: .continueLesson, title: Self.continueTitle)
    case .checking:
      return PrimaryAction(
        action: .check,
        title: LocalizedStringResource(
          "Checking your answer", table: "Player",
          comment: "The main button while a written answer is graded"),
        isBusy: true, isDisabled: true)
    case .playing, .completed:
      break
    }

    if step.isRead {
      if case .workedExample(let content) = step.content,
        (state.revealed[step.id] ?? 1) < content.steps.count
      {
        return PrimaryAction(
          action: .continueLesson,
          title: LocalizedStringResource(
            "Show the next step", table: "Player",
            comment: "Reveals the next part of a worked example"))
      }

      return PrimaryAction(
        action: .continueLesson,
        title: state.position == state.queue.count - 1
          ? Self.continueTitle
          : LocalizedStringResource(
            "Next", table: "Player", comment: "Moves to the next screen of the lesson"))
    }

    if case .challenge(let content) = step.content {
      switch ChallengeProgress(
        content: content, picks: state.challengePicks(step.id), shown: state.revealed[step.id] ?? 0)
      {
      case .intro:
        return PrimaryAction(
          action: .continueLesson,
          title: LocalizedStringResource(
            "Start", table: "Player", comment: "Starts a challenge after its intro"))
      case .ended:
        return PrimaryAction(
          action: .check,
          title: LocalizedStringResource(
            "See how it went", table: "Player", comment: "Checks a finished challenge"))
      case .deciding(_, _, _, let pending):
        return PrimaryAction(
          action: .continueLesson,
          title: LocalizedStringResource(
            "Confirm", table: "Player", comment: "Confirms a decision in a challenge"),
          isDisabled: pending == nil)
      }
    }

    let isReady = state.currentAnswer.map(isAnswerReady) ?? false

    return PrimaryAction(
      action: .check,
      title: step.kind == .hook
        ? LocalizedStringResource(
          "See the answer", table: "Player", comment: "Reveals a hook's answer after a guess")
        : LocalizedStringResource("Check", table: "Player", comment: "Checks the learner's answer"),
      isDisabled: !isReady)
  }

  private func isAnswerReady(_ answer: LessonAnswer) -> Bool {
    switch answer {
    case .typedAnswer(let text), .spokenAnswer(let text):
      !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    case .fillBlank(let answers):
      !answers.contains { $0.isEmpty }
    case .reading(let words), .listening(let words):
      !words.isEmpty
    case .matchColumns(let pairs, _):
      if case .language(let exercise, _) = step.content {
        pairs.count == (exercise.content.pairs ?? []).count
      } else {
        false
      }
    default:
      true
    }
  }

  private static let continueTitle = LocalizedStringResource(
    "Continue", table: "Player", comment: "Moves past a screen or a verdict")
}

extension LessonStep {
  /// Screens that show their own verdict: activities, challenges and match columns.
  var showsOwnResult: Bool {
    kind == .challenge || kind == .matchColumns
  }
}
