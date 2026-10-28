import SwiftUI

extension EnvironmentValues {
  /// The player's API, made once for the app; the composition root may replace it.
  @Entry var lessonPlayerAPI = LessonPlayerAPI(
    clients: .live(baseURL: AppConfiguration.current.apiBaseURL))
}

/// A Library lesson, full screen: its screens one at a time, the check and its verdict, and the
/// lesson's end. Presented as a task (`AppRoute.lesson`), with its own close button.
struct LessonPlayerScreen: View {
  @Environment(\.lessonPlayerAPI) private var api
  @Environment(SessionStore.self) private var session

  let lessonId: String
  var sessionId: String?

  var body: some View {
    LessonPlayerContent(
      store: LessonPlayerStore(
        lessonId: lessonId, studySessionId: sessionId, api: api, session: session)
    )
    .id(lessonId)
  }
}

private struct LessonPlayerContent: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.lessonCompletionHook) private var completionHook
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
          .toolbar { toolbar(hasVerticalBar: hasVerticalBar) }
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
    .inspector(isPresented: $store.isAsking) {
      if let panel = tutor.panel, let lesson = store.lesson {
        panel(
          LessonTutorScope(
            lessonId: lesson.id, stepId: store.state?.currentStep?.id,
            suggestions: lesson.tutorSuggestions, startingSuggestionId: store.askingSuggestionId))
      }
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
      store.onCompleted = { [completionHook] event in completionHook.lessonCompleted(event) }
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

  @ToolbarContentBuilder
  private func toolbar(hasVerticalBar: Bool) -> some ToolbarContent {
    ToolbarItem(placement: .cancellationAction) {
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

    if !hasVerticalBar, let progress {
      ToolbarItem(placement: .principal) {
        progressBar(progress)
          .frame(minWidth: 120, idealWidth: 240)
      }
    }

    screenMenu

    if tutor.panel != nil, store.screen == .playing, store.state?.phase != .completed {
      ToolbarItem(placement: .primaryAction) {
        Button {
          store.ask()
        } label: {
          Label {
            Text("Ask", tableName: "Player", comment: "Opens the panel to ask about the lesson")
          } icon: {
            Image(systemName: "bubble.left.and.text.bubble.right")
          }
        }
      }
    }
  }

  /// The end of a guest's lesson: where it fits and "Build my plan". Nil for learners.
  private var guestEnding: LessonGuestEnding? {
    guard store.isGuest, store.studySessionId == nil, let lesson = store.lesson else {
      return nil
    }

    return LessonGuestEnding(lessonTitle: lesson.title, fit: store.fit)
  }

  @ToolbarContentBuilder
  private var screenMenu: some ToolbarContent {
    if store.screen == .playing, let state = store.state {
      ToolbarItem(placement: .primaryAction) {
        Menu {
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
        } label: {
          Label {
            Text("Screen options", tableName: "Player", comment: "The lesson's menu")
          } icon: {
            Image(systemName: "ellipsis")
          }
        }
      }
    }
  }

  /// How far the learner is, while a lesson plays.
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

/// Whether the system shows the toolbar as a vertical bar beside the content (iPhone Duo).
private struct VerticalToolbarReader<Content: View>: View {
  @ViewBuilder let content: (Bool) -> Content

  var body: some View {
    if #available(iOS 27.1, *) {
      VerticalEdgeReader(content: content)
    } else {
      content(false)
    }
  }
}

@available(iOS 27.1, *)
private struct VerticalEdgeReader<Content: View>: View {
  @Environment(\.toolbarVerticalEdge) private var edge

  let content: (Bool) -> Content

  var body: some View {
    content(edge != nil)
  }
}
