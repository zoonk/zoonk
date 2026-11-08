import SwiftUI

@MainActor
final class LessonPlayerDependencies {
  let api: LessonPlayerAPI
  let cache: AppCache
  let preferences: Resource<LearningPreferences>
  let blockFinished: @MainActor (_ sessionID: String, BlockMoment) -> Void
  let sessionStarted: @MainActor (_ sessionID: String) -> Void
  private var lessons: [String: Resource<LessonLoad>] = [:]

  init(
    api: LessonPlayerAPI, cache: AppCache, preferences: Resource<LearningPreferences>,
    blockFinished: @escaping @MainActor (_ sessionID: String, BlockMoment) -> Void,
    sessionStarted: @escaping @MainActor (_ sessionID: String) -> Void
  ) {
    self.api = api
    self.cache = cache
    self.preferences = preferences
    self.blockFinished = blockFinished
    self.sessionStarted = sessionStarted
  }

  func lesson(id: String) -> Resource<LessonLoad> {
    if let lesson = lessons[id] {
      return lesson
    }

    let api = api
    // A lesson follows the learner's goals and active goal: a language plan's skipped activities, and
    // the active goal's versions for a lesson in no plan.
    let lesson = cache.resource(audience: .viewer, domains: [.goals, .learningProfile]) { session in
      try await api.getLesson(id: id, token: session?.bearerToken)
    }
    lessons[id] = lesson
    return lesson
  }
}

extension EnvironmentValues {
  @Entry var lessonPlayer: LessonPlayerDependencies?
}

struct LessonPlayerScreen: View {
  @Environment(\.lessonPlayer) private var player

  let lessonId: String
  var sessionId: String?
  var fromCatalog = false
  var opening: LessonOpening?
  var activated = false
  @Environment(AppRouter.self) private var router

  var body: some View {
    if let player {
      LessonPlayerContent(
        store: LessonPlayerStore(
          lessonId: lessonId, studySessionId: sessionId, fromCatalog: fromCatalog, opening: opening,
          activated: activated,
          onOpened: { opening in
            guard case .lesson(let id, _, _, _, _)? = router.tasks.last, id == lessonId else {
              return
            }
            router.dismissTask()
            let destination = StudyDestination(opening)
            router.openStudy(destination == .changed ? .today : destination)
          },
          api: player.api, cache: player.cache, preferences: player.preferences,
          lessonResource: player.lesson(id: lessonId), blockFinished: player.blockFinished,
          sessionStarted: player.sessionStarted)
      )
      .id(lessonId)
    }
  }
}

private struct LessonPlayerContent: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.scenePhase) private var scenePhase
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.lessonAudio) private var audio
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?
  @State private var store: LessonPlayerStore
  @State private var isLeaving = false
  @State private var isShowingMap = false
  @State private var soundOwner = UUID().uuidString

  init(store: LessonPlayerStore) {
    _store = State(initialValue: store)
  }

  var body: some View {
    NavigationStack {
      VerticalToolbarReader { hasVerticalBar in
        content
          // Main's task header: the title in the bar, the lesson's segments under it.
          .safeAreaBar(edge: .top) {
            if let segments {
              TaskSegments(
                segments: segments,
                label: Text(
                  "Lesson progress", tableName: "Player", comment: "Progress bar of the lesson"),
                value: Text(
                  store.state?.progress ?? 0, format: .percent.precision(.fractionLength(0)))
              )
              // The lesson's column; on iPhone Duo, the page before the hinge.
              .lonePage(readableWidth: 680)
              .scenePadding(.horizontal)
              .padding(.bottom, 4)
            }
          }
          .navigationTitle(title)
          .navigationBarTitleDisplayMode(.inline)
          // A vertical bar (iPhone Duo) has no room for a title.
          .toolbar(removing: hasVerticalBar ? .title : nil)
          .taskClose { closeButton }
          .toolbar {
            if showsUnsavedAnswers {
              ToolbarItem(placement: .primaryAction) {
                UnsavedAnswersButton()
              }
            }
          }
          .taskOptions(
            isShown: store.screen == .playing && store.state != nil,
            label: Text("Screen options", tableName: "Player", comment: "The lesson's menu")
          ) {
            if let state = store.state {
              screenMenuItems(state)
            }
          }
      }
    }
    // Beside the lesson on a spread (the stage shows it); a sheet where the lesson is one column.
    .onDisappear { store.cancelStart() }
    // The learner's own taps and key presses anywhere in the lesson, seen without taking them.
    .simultaneousGesture(TapGesture().onEnded { store.act() })
    .onKeyPress(phases: .down) { _ in
      store.act()
      return .ignored
    }
    .sheet(isPresented: isShowingAskSheet) {
      LessonAskPanel(store: store, isBeside: false)
        .zoonkStyles()
    }
    .sheet(isPresented: $isShowingMap) {
      if let lesson = store.lesson, let summary = lesson.summary {
        LessonMapSheet(title: lesson.title, summary: summary)
          .zoonkStyles()
      }
    }
    // A lesson opened while the saved session is still being checked waits for it, so it reads once.
    .task(id: session.state == .restoring ? nil : session.authenticatedSession?.bearerToken ?? "") {
      guard session.state != .restoring else {
        return
      }

      store.isUnplayable = { [activityRenderers] step in
        guard case .activity(let content) = step.content, case .interaction = content.check else {
          return false
        }

        return activityRenderers.renderer(for: content.template) == nil
      }
      await store.load()
    }
    // Per opening: a lesson written on the learner's tap opens after `load()` has returned.
    .task(id: store.openedAt) {
      await store.followLatePictures()
    }
    // A visitor who starts the lesson as a guest gets the session first and the summary after it.
    .onChange(of: learnerSummary?.summary.value?.identity.isAnonymous, initial: true) {
      _, isAnonymous in
      store.isGuest = isAnonymous == true
    }
    .onChange(of: learnerSummary?.summary.value?.activeGoalID, initial: true) { _, goalID in
      store.goalID = goalID

      if scenePhase == .active {
        store.reportFirstScene()
      }
    }
    .onChange(
      of: FirstScene(shown: store.state?.currentStep != nil, phase: scenePhase), initial: true
    ) {
      _, scene in
      if scene.shown, scene.phase == .active {
        store.reportFirstScene()
      }
    }
    .environment(\.lessonAudio, sounds)
    .onChange(of: store.state?.currentStep?.id) { sounds.stop() }
    // From here rather than the stage, which is made anew as a lesson comes back from its end.
    .announcesStatus(store.state?.noticeLine)
    .announcesStatus(
      showsUnsavedAnswers
        ? String(
          localized: "Not saved yet", table: "Player",
          comment: "Names the lesson's header icon shown while some answers haven't reached Zoonk")
        : nil
    )
    .onChange(of: scenePhase) { _, phase in
      switch phase {
      case .active: store.sendHeldAnswers()
      case .background: store.reportAbandonment()
      default: break
      }
    }
    .onDisappear {
      store.reportAbandonment()
    }
  }

  private var sounds: LessonAudio {
    audio.owned(by: soundOwner)
  }

  @ViewBuilder
  private var content: some View {
    if let warmUp = store.warmUp, case .waiting(_, let writing) = store.screen {
      WaitHold(
        surface: .lessonWait, isReady: writing == .written,
        announcement: LessonWaitingView.lessonReady
      ) { stage in
        switch stage {
        case .waiting(let holding):
          LessonWaitingView(
            outline: warmUp.outline, writing: writing, progress: store.writingProgress,
            alternative: store.alternative, warmUpID: warmUp.deckID, holding: holding
          ) {
            Task { await store.writeLesson() }
          }
          .lonePage()
        case .ready:
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .lonePage()
        }
      } onMoveOn: {
        Task { await store.open() }
      }
    } else {
      screen
    }
  }

  @ViewBuilder
  private var screen: some View {
    switch store.screen {
    case .loading:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .lonePage()
    case .failed:
      LessonUnavailableView(refusal: .failed) {
        Task { await store.load() }
      }
      .lonePage()
    case .notFound:
      LessonUnavailableView(refusal: .notFound, retry: {})
        .lonePage()
    case .sessionRequired(let outline):
      LessonGuestGateView(outline: outline) {
        Task { await store.load() }
      }
      .lonePage()
    case .waiting(let outline, let writing):
      LessonWaitingView(
        outline: outline, writing: writing, progress: store.writingProgress,
        alternative: store.alternative
      ) {
        Task { await store.writeLesson() }
      }
      .lonePage()
    case .playing:
      if let state = store.state {
        if case .refused(let refusal) = state.run {
          LessonUnavailableView(refusal: refusal) {
            Task { await store.load() }
          }
          .lonePage()
        } else if state.phase == .completed, let completion = state.completion {
          LessonCompletionView(
            completion: completion, correct: state.correctCount, answered: state.answeredCount,
            soundsEnabled: store.soundsEnabled, guestEnding: guestEnding, lesson: store.lesson
          ) {
            Task { await store.finish() }
          } close: {
            dismiss()
          }
        } else if state.phase == .map, let lesson = store.lesson, let summary = lesson.summary {
          LessonMapStage(store: store, state: state, title: lesson.title, summary: summary)
        } else {
          LessonStageView(store: store, state: state)
            .onDisappear { sounds.stop() }
        }
      }
    }
  }

  private var closeButton: some View {
    Button {
      if hasUnsentAnswer {
        isLeaving = true
      } else {
        dismiss()
      }
    } label: {
      Label {
        Text("Close lesson", tableName: "Player", comment: "Button that closes the lesson")
      } icon: {
        Image(systemName: "xmark")
      }
    }
    .keyboardShortcut(.cancelAction)
    // On the button, so the dialog comes from it.
    .confirmationDialog(
      Text(
        "Leave for now?", tableName: "Player",
        comment: "Title of the dialog when closing a lesson in progress"),
      isPresented: $isLeaving,
      titleVisibility: .visible
    ) {
      Button(role: .destructive) {
        dismiss()
      } label: {
        Text(
          "Leave", tableName: "Player",
          comment: "Closes the lesson, dropping an answer not checked yet")
      }

      Button(role: .cancel) {
      } label: {
        Text(
          "Keep writing", tableName: "Player", comment: "Stays in the lesson to finish an answer")
      }
    } message: {
      Text(
        "Your answer hasn't been checked, so it won't be kept.", tableName: "Player",
        comment: "Closing a lesson with a written answer not checked yet")
    }
  }

  /// Ask's sheet, shown only when Ask was opened where the lesson is one column, so a size change
  /// alone (closing iPhone Duo with Ask beside the lesson) never covers the lesson. SwiftUI turns a
  /// presented inspector into a sheet on such a change, and presented while iPhone Duo is folded
  /// it leaves the lesson running under it, so Ask is a pane beside the lesson instead.
  private var isShowingAskSheet: Binding<Bool> {
    Binding {
      store.isAsking && store.isAskingInSheet
    } set: { isShown in
      if !isShown {
        store.isAsking = false
      }
    }
  }

  private var guestEnding: LessonGuestEnding? {
    guard store.endsAsGuest, let lesson = store.lesson else {
      return nil
    }

    return LessonGuestEnding(lessonTitle: lesson.title, fit: store.fit)
  }

  @ViewBuilder
  private func screenMenuItems(_ state: LessonPlayerState) -> some View {
    Section {
      Label {
        Text(
          "Made with AI. It may contain mistakes.", tableName: "Player",
          comment: "In the lesson's menu")
      } icon: {
        Image(systemName: "sparkles")
      }
    }

    if state.canKnowThis {
      Button {
        store.knowThis()
      } label: {
        Label {
          Text(
            "I already know this", tableName: "Player",
            comment: "Asks the lesson's checks to skip it")
        } icon: {
          Image(systemName: "bolt")
        }
      }
    }

    if state.phase == .completed, store.lesson?.summary != nil {
      Button {
        isShowingMap = true
      } label: {
        Label {
          Text(LessonMapView.name)
        } icon: {
          Image(systemName: LessonMapView.symbol)
        }
      }
    }
  }

  private var title: Text {
    if let lesson = store.lesson {
      Text(lesson.title)
    } else if case .waiting(let outline, _) = store.screen {
      Text(outline.title)
    } else {
      Text("Lesson", tableName: "Player", comment: "Names a lesson's screen until its title loads")
    }
  }

  private var showsUnsavedAnswers: Bool {
    store.screen == .playing && store.hasUnsavedAnswers
  }

  private var segments: [TaskSegment]? {
    guard let state = store.state, store.screen == .playing, state.phase != .completed else {
      return nil
    }

    if case .refused = state.run {
      return nil
    }

    return state.segments
  }

  /// Words on the screen stay protected until their check saves; every other answer is already kept.
  private var hasUnsentAnswer: Bool {
    guard let state = store.state, state.phase == .playing || state.phase == .checking,
      let text = state.currentAnswer?.text
    else {
      return false
    }

    return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }
}

/// Quiet on purpose: the lesson goes on, and the answers go out again on their own.
private struct UnsavedAnswersButton: View {
  @State private var explains = false

  var body: some View {
    Button {
      explains = true
    } label: {
      Label {
        Text(
          "Not saved yet", tableName: "Player",
          comment: "Names the lesson's header icon shown while some answers haven't reached Zoonk")
      } icon: {
        Image(systemName: "icloud.slash")
      }
    }
    .tint(.mutedForeground)
    .popover(isPresented: $explains) {
      Text(
        "Some answers aren't saved yet. We'll keep trying while this lesson is open.",
        tableName: "Player",
        comment: "Opens from the lesson's header icon for answers not saved yet"
      )
      .typeStyle(.note)
      .padding()
      .frame(idealWidth: 280)
      .presentationCompactAdaptation(.popover)
      .zoonkStyles()
    }
  }
}

struct LessonAskPanel: View {
  @Environment(\.lessonTutor) private var tutor

  let store: LessonPlayerStore
  let isBeside: Bool

  var body: some View {
    if let panel = tutor.panel, let lesson = store.lesson {
      let stepId = store.state?.currentStep?.id

      panel(
        LessonTutorScope(
          lessonId: lesson.id, stepId: stepId,
          stepNumber: store.state.flatMap { $0.currentStep == nil ? nil : $0.position + 1 },
          answer: store.state?.answerInView, stepIds: store.state?.lessonOrder ?? [],
          suggestions: isBeside ? store.suggestionsBeside : lesson.tutorSuggestions,
          startingOffer: store.startingOffer(about: stepId)),
        isBeside)
    }
  }
}

/// Read inside the lesson's own navigation stack, whose bar it is.
private struct VerticalToolbarReader<Content: View>: View {
  @Environment(\.isToolbarVertical) private var isToolbarVertical
  @ViewBuilder let content: (Bool) -> Content

  var body: some View {
    content(isToolbarVertical)
  }
}

private struct FirstScene: Equatable {
  let shown: Bool
  let phase: ScenePhase
}
