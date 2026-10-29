import SwiftUI

@MainActor
final class LessonPlayerDependencies {
  let api: LessonPlayerAPI
  let cache: AppCache
  let preferences: Resource<LearningPreferences>
  private var lessons: [String: Resource<LessonLoad>] = [:]

  init(api: LessonPlayerAPI, cache: AppCache, preferences: Resource<LearningPreferences>) {
    self.api = api
    self.cache = cache
    self.preferences = preferences
  }

  func lesson(id: String) -> Resource<LessonLoad> {
    if let lesson = lessons[id] {
      return lesson
    }

    let api = api
    let lesson = cache.resource(audience: .viewer) { session in
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

  var body: some View {
    if let player {
      LessonPlayerContent(
        store: LessonPlayerStore(
          lessonId: lessonId, studySessionId: sessionId, api: player.api, cache: player.cache,
          preferences: player.preferences, lessonResource: player.lesson(id: lessonId))
      )
      .id(lessonId)
    }
  }
}

private struct LessonPlayerContent: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.lessonTutor) private var tutor
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?
  @State private var store: LessonPlayerStore
  @State private var isLeaving = false
  @State private var isShowingSummary = false

  init(store: LessonPlayerStore) {
    _store = State(initialValue: store)
  }

  var body: some View {
    NavigationStack {
      VerticalToolbarReader { hasVerticalBar in
        content
          .safeAreaBar(edge: .top) {
            // A vertical bar (iPhone Duo) has no room for the progress bar, so it tops the screen.
            if hasVerticalBar, let progress {
              progressBar(progress)
                .scenePadding(.horizontal)
            }
          }
          .navigationBarTitleDisplayMode(.inline)
          .taskClose { closeButton }
          .toolbar {
            if !hasVerticalBar, let progress {
              ToolbarItem(placement: .principal) {
                progressBar(progress)
                  .frame(minWidth: 120, idealWidth: 240)
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
          .taskAction(
            isShown: tutor.panel != nil && store.screen == .playing
              && store.state?.phase != .completed
          ) {
            askButton
          }
      }
    }
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
    // Beside the lesson on a spread (the stage shows it); a sheet where the lesson is one column.
    .sheet(isPresented: isShowingAskSheet) {
      LessonAskPanel(store: store, isBeside: false)
    }
    .sheet(isPresented: $isShowingSummary) {
      LessonSummarySheet(ideas: store.lesson?.summaryIdeas ?? [])
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
      store.isGuest = learnerSummary?.summary.value?.identity.isAnonymous == true
      await store.load()
      await store.followLatePictures()
    }
  }

  @ViewBuilder
  private var content: some View {
    switch store.screen {
    case .loading:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .failed:
      LessonUnavailableView(refusal: .failed) {
        Task { await store.load() }
      }
    case .notFound:
      LessonUnavailableView(refusal: .notFound, retry: {})
    case .sessionRequired(let outline):
      LessonGuestGateView(outline: outline) {
        Task { await store.load() }
      }
    case .waiting(let outline, let writing):
      LessonWaitingView(outline: outline, writing: writing) {
        Task { await store.writeLesson() }
      }
    case .playing:
      if let state = store.state {
        if case .refused(let refusal) = state.run {
          LessonUnavailableView(refusal: refusal) {
            Task { await store.load() }
          }
        } else if state.phase == .completed, let completion = state.completion {
          LessonCompletionView(
            completion: completion, correct: state.correctCount, answered: state.answeredCount,
            soundsEnabled: store.soundsEnabled, guestEnding: guestEnding
          ) {
            Task { await store.finish() }
          } close: {
            dismiss()
          }
        } else {
          LessonStageView(store: store, state: state)
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
  }

  private var askButton: some View {
    Button {
      // Beside the lesson, Ask also closes the panel, as an inspector's button does; elsewhere it
      // opens it, including one left open beside the lesson before iPhone Duo closed.
      if store.isAsking, store.isSpread {
        store.isAsking = false
      } else {
        store.ask()
      }
    } label: {
      Label {
        Text("Ask", tableName: "Player", comment: "Opens the panel to ask about the lesson")
      } icon: {
        Image(systemName: "bubble.left.and.text.bubble.right")
      }
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
    guard store.isGuest, store.studySessionId == nil, let lesson = store.lesson else {
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

    if state.phase == .completed, !(store.lesson?.summaryIdeas ?? []).isEmpty {
      Button {
        isShowingSummary = true
      } label: {
        Label {
          Text(
            "Lesson summary", tableName: "Player", comment: "Opens the lesson's summary card")
        } icon: {
          Image(systemName: "list.bullet.rectangle")
        }
      }
    }
  }

  private var progress: Double? {
    guard let state = store.state, store.screen == .playing, state.phase != .completed else {
      return nil
    }

    if case .refused = state.run {
      return nil
    }

    return state.progress
  }

  private func progressBar(_ value: Double) -> some View {
    ProgressView(value: value)
      .tint(.success)
      .accessibilityLabel(
        Text("Lesson progress", tableName: "Player", comment: "Progress bar of the lesson"))
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

struct LessonAskPanel: View {
  @Environment(\.lessonTutor) private var tutor

  let store: LessonPlayerStore
  let isBeside: Bool

  var body: some View {
    if let panel = tutor.panel, let lesson = store.lesson {
      panel(
        LessonTutorScope(
          lessonId: lesson.id, stepId: store.state?.currentStep?.id,
          stepNumber: store.state.flatMap { $0.currentStep == nil ? nil : $0.position + 1 },
          answer: store.state?.answerInView, stepIds: store.state?.lessonOrder ?? [],
          suggestions: lesson.tutorSuggestions, startingSuggestionId: store.askingSuggestionId),
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
