import SwiftUI

/// One screen of the lesson, its verdict or "fix it" note once checked (scrolled into view, so the
/// bar stays small at large text sizes), and the action bar pinned at the bottom with the one next
/// action (Check, Continue, ...) and Previous.
///
/// Where each half gets a phone-width column (the open iPhone Duo, iPad, a phone in landscape) the
/// screen is a spread, by `PaneSpace`'s rule: the screen on the leading page, the learner's turn on
/// the trailing one with the action bar at its bottom, so the bar never moves from one screen to
/// the next; partially folded like a book, the pages meet at the fold. Elsewhere it's one column:
/// the screen, then the turn. The trailing page is the same view in both, so what the learner is
/// doing (a canvas, a recording, a field) carries through a fold, an unfold or a rotation.
struct LessonStageView: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let store: LessonPlayerStore
  let state: LessonPlayerState

  private static let verdictId = "verdict"
  private static let checkNoteId = "check-note"

  /// A verdict that counts: a hook's guess is never wrong and "I don't know yet" has none.
  private func countedVerdict(_ step: LessonStep) -> Bool? {
    guard let result = state.currentResult, step.kind != .hook, !result.isSampleAnswer else {
      return nil
    }

    return result.isCorrect
  }

  /// The spread's pages, or nil for one column, which accessibility text sizes always get. While
  /// Ask's inspector sits beside the lesson (regular widths; a sheet covers it on compact ones), the
  /// screen shows whole in one column, so the learner sees what they're asking about.
  private func pages(_ proxy: GeometryProxy) -> PaneSpace.Panes? {
    guard !dynamicTypeSize.isAccessibilitySize,
      !(store.isAsking && horizontalSizeClass == .regular)
    else {
      return nil
    }

    return PaneSpace(proxy).panes(primaryShare: 0.5)
  }

  var body: some View {
    if let step = state.currentStep {
      // A reader, so a wide screen never shows the one-column version first.
      GeometryReader { proxy in
        let pages = pages(proxy)

        HStack(spacing: 0) {
          if let pages {
            LessonPage(store: store) {
              LessonNotice(state: state, store: store)

              VStack(alignment: .leading, spacing: 20) {
                LessonStepView(step: step, state: state, store: store, part: .screen)
                LessonStepNotes(step: step, store: store)
              }
            }
            .frame(width: pages.primary)
          }

          ScrollViewReader { scroll in
            LessonPage(store: store) {
              if pages == nil {
                LessonNotice(state: state, store: store)
              }

              VStack(alignment: .leading, spacing: 20) {
                if pages == nil {
                  LessonStepView(step: step, state: state, store: store, part: .screen)
                }

                LessonStepView(step: step, state: state, store: store, part: .turn)

                if pages == nil {
                  LessonStepNotes(step: step, store: store)
                }
              }

              LessonCheckNote(state: state)
                .id(Self.checkNoteId)

              if let result = state.currentResult, state.phase == .feedback, !step.showsOwnResult {
                LessonVerdictView(
                  step: step, result: result, store: store,
                  willReturn: state.queue.lastIndex(of: step.id).map { $0 > state.position }
                    ?? false,
                  hyperdriveStreak: state.hyperdriveStreak(for: step.id)
                )
                .id(Self.verdictId)

                if state.struggleOffer != nil {
                  LessonAskBuddyOffer(reason: .misses, store: store)
                }
              }

              if step.strugglePause != nil {
                LessonPauseOffer(step: step, store: store)
              }
            }
            .onChange(of: state.currentResult != nil) { _, hasResult in
              if hasResult {
                scroll.scrollTo(Self.verdictId, anchor: .bottom)
              }
            }
            .onChange(of: state.notice == .selfCorrect || state.checkFailed) { _, hasNote in
              if hasNote {
                scroll.scrollTo(Self.checkNoteId, anchor: .bottom)
              }
            }
          }
          .safeAreaBar(edge: .bottom) {
            // On the trailing page the bar is already past the fold; one column moves it there.
            LessonActionBar(store: store, state: state, step: step)
              .keepsOffFold()
          }
          // The fold is the trailing page's safe area, so its content and the action bar stay
          // clear of the crease.
          .safeAreaPadding(.leading, pages?.gap ?? 0)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .environment(\.isPaneSplit, pages != nil)
      }
      .id(step.id)
      .task(id: step.id) {
        if step.hasExampleLineSlot {
          await store.loadExampleLine(stepId: step.id)
        }
      }
      .simultaneousGesture(TapGesture().onEnded { store.touches += 1 })
      .scrollDismissesKeyboard(.interactively)
      .sensoryFeedback(trigger: countedVerdict(step)) { _, isCorrect in
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

/// One page of the stage: a column of the screen's parts that scrolls on its own, as wide as a
/// readable line.
private struct LessonPage<Content: View>: View {
  let store: LessonPlayerStore
  @ViewBuilder let content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        content
      }
      .frame(maxWidth: 680, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .onScrollPhaseChange { _, phase in
      if phase != .idle {
        store.touches += 1
      }
    }
  }
}

/// What a screen notes under itself: the learner's own example of the idea, once written, and where
/// it comes from. Last, so a line arriving after the screen shows moves nothing.
private struct LessonStepNotes: View {
  let step: LessonStep
  let store: LessonPlayerStore

  var body: some View {
    LessonExampleLine(line: store.exampleLines[step.id])

    if let citation = step.citation {
      LessonCitationView(citation: citation)
    }
  }
}

/// Under a checked screen with no verdict yet: a language answer to fix once, or a check the
/// server couldn't make.
private struct LessonCheckNote: View {
  let state: LessonPlayerState

  var body: some View {
    if state.notice == .selfCorrect {
      Label {
        Text(
          "Not quite. Look again and fix it yourself, then check.", tableName: "Player",
          comment: "A wrong language answer the learner can fix once")
      } icon: {
        Image(systemName: "pencil")
      }
      .font(.subheadline.weight(.medium))
      .foregroundStyle(.destructive)
    }

    if state.checkFailed {
      Text(
        "We couldn't check your answer this time. Try again.", tableName: "Player",
        comment: "The server couldn't grade a written or spoken answer"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }
}

/// The task's action bar: Previous and the one next action. Return does what the main button says,
/// as on main.
struct LessonActionBar: View {
  let store: LessonPlayerStore
  let state: LessonPlayerState
  let step: LessonStep

  @Environment(\.activityRenderers) private var activityRenderers

  var body: some View {
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
        .buttonBorderShape(.circle)
        .controlSize(.large)
        .keyboardShortcut(.leftArrow, modifiers: [])
      }

      primaryButton
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
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .disabled(primary.isDisabled)
    .keyboardShortcut(.defaultAction)
  }

  private var activityGrade: ((ActivityStepContent, ActivityAnswer) -> Bool)? {
    guard case .activity(let content) = step.content else {
      return nil
    }

    return activityRenderers.renderer(for: content.template)?.grade
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
      // A question waits for the picture it asks about while it's still being drawn.
      isDisabled: !isReady || state.isWaitingForPicture(step, openedAt: store.openedAt))
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

/// "I know this" in progress, an answer that didn't save, or writing left out for the rest of the
/// day, above the screen.
private struct LessonNotice: View {
  let state: LessonPlayerState
  let store: LessonPlayerStore

  var body: some View {
    if let quickCheck = state.quickCheckProgress {
      Label {
        Text(
          "Quick check · \(quickCheck.current) of \(quickCheck.total)", tableName: "Player",
          comment: "While \"I already know this\" asks the lesson's checks")
      } icon: {
        Image(systemName: "bolt")
      }
      .font(.caption.monospaced())
      .foregroundStyle(.secondary)
    } else {
      switch state.notice {
      case .answerNotSaved:
        Label {
          Text(
            "Your answer here didn't save. Answer it again to finish the lesson.",
            tableName: "Player",
            comment: "The lesson came back to a screen whose answer was never saved")
        } icon: {
          Image(systemName: "icloud.slash")
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
      case .writingSkipped:
        HStack(alignment: .firstTextBaseline) {
          Label {
            Text(
              "No more writing today.", tableName: "Player",
              comment: "\"Can't write now\" left the lesson's writing out")
          } icon: {
            Image(systemName: "pencil.slash")
          }
          .foregroundStyle(.secondary)

          Spacer(minLength: 8)

          if state.writingRestore != nil, state.phase == .playing {
            Button {
              store.restoreWriting()
            } label: {
              Text("Write again", tableName: "Player", comment: "Takes back \"Can't write now\"")
            }
            .buttonStyle(.borderless)
          }
        }
        .font(.subheadline)
      case .selfCorrect, nil:
        EmptyView()
      }
    }
  }
}
