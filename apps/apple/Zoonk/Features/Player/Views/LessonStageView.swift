import SwiftUI

struct LessonStageView: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.lessonTutor) private var tutor
  @Environment(\.lessonAudio) private var audio
  @Environment(\.spokenAnswerRecording) private var recording

  let store: LessonPlayerStore
  let state: LessonPlayerState

  private struct ShownPrompt: Equatable {
    let stepId: String
    let url: URL?
  }

  private static let verdictId = "verdict"
  private static let checkNoteId = "check-note"
  private static let turnId = "turn"

  /// A verdict that counts: a hook's guess is never wrong and "I don't know yet" has none.
  private func countedVerdict(_ step: LessonStep) -> Bool? {
    guard let result = state.currentResult, step.kind != .hook, !result.isSampleAnswer else {
      return nil
    }

    return result.isCorrect
  }

  /// Main's verdict is a live status region: VoiceOver says it as it arrives, wherever focus is.
  private func announceVerdict() {
    guard let step = state.currentStep, let result = state.currentResult, !step.showsOwnResult
    else { return }

    var announcement = AttributedString(
      String(localized: LessonVerdict.of(result, step: step).title))
    announcement.accessibilitySpeechAnnouncementPriority = .high
    AccessibilityNotification.Announcement(announcement).post()
  }

  private func visit(_ step: LessonStep) -> String {
    "\(step.id)/\(state.rounds[step.id] ?? 0)"
  }

  /// Main's `ListeningInstead`: a spoken screen answered by listening is a listening screen.
  private func shownPrompt(_ step: LessonStep) -> ShownPrompt {
    guard case .spokenAnswer(_, let listening?) = step.content else {
      return ShownPrompt(stepId: step.id, url: step.promptAudio)
    }

    let mode = store.spokenAnswerMode(canListen: true, canSpeak: recording.input != nil)
    return ShownPrompt(stepId: step.id, url: mode == .listen ? listening.promptAudio : nil)
  }

  private func recapView(_ recap: LessonRecap, on step: LessonStep) -> some View {
    let visit = visit(step)

    return LessonRecapView(
      recap: recap,
      isExpanded: Binding {
        store.openRecap == visit
      } set: {
        store.openRecap = $0 ? visit : nil
      })
  }

  var body: some View {
    if let step = state.currentStep {
      // A reader, so a wide screen never shows the one-column version first.
      GeometryReader { proxy in
        let space = PaneSpace(proxy)
        let pages = space.panes(primaryShare: 0.5, stacked: isStacked)
        // While asking on a spread, the screen shows whole in one column on the leading page, so the
        // learner sees what they're asking about, and the buddy has the trailing page.
        let isAskingBeside = pages != nil && store.isAsking
        let spread = isAskingBeside ? nil : pages
        // Help that's always beside a teaching screen leaves its pause nothing to offer.
        let offersHelp =
          spread != nil && step.teachesInText && tutor.panel != nil && !store.isGuest
        let recap = state.recap

        HStack(spacing: 0) {
          if let pages = spread {
            LessonPage(store: store) {
              LessonNotice(state: state, store: store)

              VStack(alignment: .leading, spacing: 20) {
                LessonStepView(step: step, state: state, store: store, part: .screen)
                LessonStepNotes(step: step, store: store)
              }

              // The page the learner reads ends with what the question rests on.
              if let recap {
                recapView(recap, on: step)
              }
            }
            .frame(width: pages.primary)
          }

          ScrollViewReader { scroll in
            LessonPage(store: store, fillsHeight: spread == nil && step.hasWordBank) {
              if spread == nil {
                LessonNotice(state: state, store: store)
              }

              VStack(alignment: .leading, spacing: 20) {
                if spread == nil {
                  LessonStepView(step: step, state: state, store: store, part: .screen)
                }

                // One container, so the id names the whole turn rather than each of its views.
                VStack(alignment: .leading, spacing: 20) {
                  LessonStepView(step: step, state: state, store: store, part: .turn)

                  if offersHelp {
                    LessonScreenHelp(store: store)
                  }
                }
                .id(Self.turnId)

                if spread == nil {
                  LessonStepNotes(step: step, store: store)
                }
              }

              LessonCheckNote(state: state)
                .id(Self.checkNoteId)

              if let result = state.currentResult, state.phase == .feedback, !step.showsOwnResult {
                VStack(alignment: .leading, spacing: 24) {
                  LessonVerdictView(
                    step: step, result: result, store: store,
                    willReturn: state.queue.lastIndex(of: step.id).map { $0 > state.position }
                      ?? false,
                    hyperdriveStreak: state.hyperdriveStreak(for: step.id)
                  )

                  if state.struggleOffer != nil {
                    LessonAskBuddyOffer(reason: .misses, store: store)
                  }
                }
                .id(Self.verdictId)
              }

              if step.strugglePause != nil, !offersHelp {
                LessonPauseOffer(step: step, store: store)
              }

              if spread == nil, let recap {
                recapView(recap, on: step)
              }
            }
            // The server's verdict can add lines to the device's ("Saved to your mistakes"), so
            // every change of the result scrolls the verdict whole into view again.
            .onChange(of: state.currentResult) { old, result in
              guard result != nil else {
                return
              }

              scroll.scrollTo(Self.verdictId, anchor: .bottom)

              if old == nil {
                announceVerdict()
              }
            }
            .onChange(of: state.notice == .selfCorrect || state.checkFailed) { _, hasNote in
              if hasNote {
                scroll.scrollTo(Self.checkNoteId, anchor: .bottom)
              }
            }
            // "Show the next step" adds a worked example's step under the others, where the page
            // may have run out of room.
            .onChange(of: step.kind == .workedExample ? state.revealed[step.id] : nil) {
              withAnimation {
                scroll.scrollTo(Self.turnId, anchor: .bottom)
              }
            }
            // Raising the keyboard reveals only a field's text; the learner's turn shows whole above
            // the action bar instead. Typing to Ask leaves the lesson where it is.
            .task {
              for await _ in NotificationCenter.default.notifications(
                named: UIResponder.keyboardDidShowNotification)
              where !store.isAsking {
                withAnimation {
                  scroll.scrollTo(Self.turnId, anchor: .bottom)
                }
              }
            }
          }
          .safeAreaBar(edge: .bottom) {
            LessonActionBar(store: store, state: state, step: step)
          }
          // The hinge is the trailing page's safe area, so its content and the action bar stay
          // clear of the crease. One column keeps to the page before it, as `PaneSplit`'s does.
          .safeAreaPadding(.leading, spread?.gap ?? 0)
          .safeAreaPadding(.trailing, pages == nil ? space.lonePageInset : 0)
          .frame(width: isAskingBeside ? pages?.primary : nil)
          .frame(maxWidth: isAskingBeside ? nil : .infinity, maxHeight: .infinity, alignment: .top)

          if isAskingBeside, let pages {
            LessonAskPanel(store: store, isBeside: true)
              .safeAreaPadding(.leading, pages.gap)
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
          }
        }
        .environment(\.isPaneSplit, spread != nil)
        .environment(\.isLessonStepChecked, state.phase == .feedback)
        .environment(
          \.lessonScreenHeight,
          proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom
        )
        .environment(\.lessonPageHeight, proxy.size.height)
        .environment(store.promptAudio)
        .onChange(of: pages != nil, initial: true) { _, isSpread in
          store.isSpread = isSpread
        }
      }
      // A screen whose answer starts over (a missed question coming straight back) is made anew,
      // as another screen would be, so its canvas starts over too.
      .id(visit(step))
      .onChange(of: shownPrompt(step), initial: true) { _, shown in
        store.promptAudio.enter(prompt: shown.url, audio: audio)
      }
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

struct LessonPage<Content: View>: View {
  @State private var visibleHeight: CGFloat?

  let store: LessonPlayerStore
  var fillsHeight = false
  @ViewBuilder let content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        content
      }
      .frame(maxWidth: 680, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
      .frame(minHeight: fillsHeight ? visibleHeight : nil, alignment: .top)
    }
    .onScrollGeometryChange(for: CGFloat.self, of: \.containerSize.height) { _, height in
      visibleHeight = height
    }
    .onScrollPhaseChange { _, phase in
      if phase != .idle {
        store.touches += 1
      }
    }
  }
}

/// Last, so a line arriving after the screen shows moves nothing.
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

/// Return does what the main button says, as on main.
struct LessonActionBar: View {
  let store: LessonPlayerStore
  let state: LessonPlayerState
  /// Nil on the lesson map, which is read like a screen.
  let step: LessonStep?

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

      if let step, step.isRead {
        LessonAudioButton(url: step.promptAudio, style: .bar)
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
    guard case .activity(let content) = step?.content else {
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
    guard let step else {
      return PrimaryAction(action: .continueLesson, title: Self.continueTitle)
    }

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
    case .playing, .map, .completed:
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
        title: state.isLastScreen
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
      isDisabled: !isReady || step.isRequiredPictureDrawing(openedAt: store.openedAt))
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
      if case .language(let exercise, _) = step?.content {
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
  var showsOwnResult: Bool {
    kind == .challenge || kind == .matchColumns
  }

  fileprivate var hasWordBank: Bool {
    guard case .language(let exercise, _) = content else {
      return false
    }

    return [.reading, .listening, .fillBlank].contains(exercise.kind)
  }
}

private struct LessonNotice: View {
  let state: LessonPlayerState
  let store: LessonPlayerStore

  var body: some View {
    if let quickCheck = state.quickCheckProgress {
      Label {
        Text(
          "Quick check\u{00A0}· \(quickCheck.current) of \(quickCheck.total)", tableName: "Player",
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
              Text(
                "Write again", tableName: "Player",
                comment: "Takes back \"Can't write now\": the learner does the writing again")
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
