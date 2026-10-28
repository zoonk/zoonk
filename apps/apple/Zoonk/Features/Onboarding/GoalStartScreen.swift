import SwiftUI

/// The start flow as a full-screen task ("New goal", or what Today's box sent): the typed goal, a short wait while it's read, "Here's what I understood" to confirm, then the goal's own onboarding screens in place. Back goes to the words, kept. A guest whose one goal is taken is asked to create an account before typing anything.
struct GoalStartScreen: View {
  /// Words a link or another screen filled in (main's `/start?goal=`); the learner sends them.
  var goal: String?

  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    GoalStartFlow(
      sentGoal: onboarding.sentGoal, prefill: goal, needsAccount: needsAccount, limit: upFrontLimit)
  }

  /// A guest whose one goal is taken: only an account adds another.
  private var needsAccount: Bool {
    guard let summary = learner.summary.value else {
      return false
    }

    return summary.identity.isAnonymous && !summary.followedGoals.isEmpty
  }

  /// The free plan's one goal at a time, said before the learner types; creating a goal checks it again.
  private var upFrontLimit: GoalLimitReason? {
    guard let summary = learner.summary.value, summary.tier == .free,
      summary.followedGoals.contains(where: { $0.status == .active })
    else {
      return nil
    }

    return .oneActiveGoal
  }
}

/// A guest whose one goal is taken, before they type another: only an account adds one, and their plan comes with them (main's `GuestGoalGate`).
private struct GuestGoalGate: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Create a free account to start another goal", tableName: "Onboarding",
          comment: "Title when a guest with a goal opens the start flow")
      } icon: {
        Image(systemName: "person.crop.circle.badge.plus")
      }
    } description: {
      Text(
        "Without an account, you can follow one goal. Your plan and progress come with you.",
        tableName: "Onboarding", comment: "Why a guest needs an account to start another goal")
    } actions: {
      Button {
        router.present(.signIn)
      } label: {
        Text(
          "Create a free account", tableName: "Onboarding",
          comment: "Opens sign-up; a guest's plan and progress come with them")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)

      Button {
        router.showRoot(of: .today)
      } label: {
        Text("Back to Today", tableName: "Onboarding", comment: "Leaves the start flow for Today")
      }
    }
  }
}

private enum StartPage: Hashable {
  case draft
}

/// What the draft page shows: the words just sent, or the draft they became.
private enum DraftState {
  case sending(String)
  case draft(OnboardingDraft, sentHere: Bool)
}

private struct GoalStartFlow: View {
  let limit: GoalLimitReason?
  /// Decided when the flow opens: the goal this flow creates mustn't turn it into the gate.
  @State private var needsAccount: Bool

  @Environment(OnboardingStore.self) private var onboarding
  @State private var path: [StartPage] = []
  @State private var words: String
  @State private var error: GoalError?
  @State private var draft: DraftState?
  @State private var goalID: String?
  @State private var sending: Task<Void, Never>?

  init(sentGoal: String?, prefill: String?, needsAccount: Bool, limit: GoalLimitReason?) {
    self.limit = limit
    _needsAccount = State(initialValue: needsAccount)
    _words = State(initialValue: sentGoal ?? prefill ?? "")
    _draft = State(initialValue: sentGoal.map(DraftState.sending))
    _path = State(initialValue: sentGoal == nil ? [] : [.draft])
  }

  var body: some View {
    if needsAccount {
      NavigationStack {
        GuestGoalGate()
          .closesTask()
      }
    } else if let goalID {
      NavigationStack {
        GoalSetupContent(goalID: goalID) {
          self.goalID = nil
          words = ""
          draft = nil
          path = []
        }
      }
    } else {
      NavigationStack(path: $path) {
        List {
          StepHeader(
            title: Text(
              "What do you want to achieve?", tableName: "Onboarding",
              comment: "Title of the start flow's first screen"),
            description: Text(
              "Tell us in your own words. We'll build the plan.", tableName: "Onboarding",
              comment: "Under the start flow's first title"))

          GoalEntrySections(words: $words, error: error, limit: limit) { goal in
            send(goal)
          }
        }
        .closesTask()
        .navigationDestination(for: StartPage.self) { _ in
          draftPage
            .closesTask()
        }
      }
      // Today's box sent the words with the tap that opened this screen.
      .task {
        if case .sending(let goal) = draft, onboarding.takeSentGoal() != nil {
          send(goal)
        }
      }
      .onChange(of: path) { _, path in
        // Back from the draft: the words wait in the box, and nothing still being sent shows up.
        if path.isEmpty {
          sending?.cancel()
          draft = nil
        }
      }
    }
  }

  @ViewBuilder
  private var draftPage: some View {
    switch draft {
    case .sending(let goal):
      UnderstandingWaitView(goal: goal, generationID: nil) {}
    case .draft(let value, let sentHere):
      DraftView(
        draft: value,
        sentHere: sentHere,
        onDraft: { draft = .draft($0, sentHere: sentHere) },
        onRewrite: send,
        onBack: { path = [] },
        onCreated: { goalID = $0 })
    case nil:
      EmptyView()
    }
  }

  private func send(_ goal: String) {
    sending?.cancel()
    words = goal
    error = nil
    draft = .sending(goal)

    if path.isEmpty {
      path = [.draft]
    }

    sending = Task {
      do {
        let value = try await onboarding.understand(goal: goal)

        guard !Task.isCancelled else {
          return
        }

        draft = .draft(value, sentHere: true)
      } catch is CancellationError {
        // The write is obsolete: the learner who asked is gone, so nothing shows.
      } catch {
        guard !Task.isCancelled else {
          return
        }

        self.error = GoalError.starting(error)
        path = []
      }
    }
  }
}

/// The typed goal as its draft says now: the wait while its words are read (or the way to try again), then what they turned out to be.
private struct DraftView: View {
  let draft: OnboardingDraft
  let sentHere: Bool
  let onDraft: (OnboardingDraft) -> Void
  let onRewrite: (String) -> Void
  let onBack: () -> Void
  let onCreated: (String) -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var retryError: GoalError?
  @State private var isRetrying = false

  var body: some View {
    switch draft.status {
    case .understanding:
      UnderstandingWaitView(goal: draft.prompt, generationID: draft.generationId) {
        await reload()
      }
    case .failed:
      failed
    case .understood:
      ReadDraftView(
        draft: draft, sentHere: sentHere, onDraft: onDraft, onRewrite: onRewrite, onBack: onBack,
        onCreated: onCreated)
    }
  }

  /// The words couldn't be read: starting it again is new work, so it waits for the learner's tap.
  private var failed: some View {
    List {
      StepHeader(
        title: Text(
          "Understanding your goal", tableName: "Onboarding",
          comment: "Title while a typed goal is read"),
        description: nil)

      TypedGoalSection(goal: draft.prompt)

      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text("This didn't finish", tableName: "Onboarding", comment: "A run that failed")
              .font(.headline)
            Text(
              "Something went wrong on our side.", tableName: "Onboarding",
              comment: "Why a run failed")
          }
        } icon: {
          Image(systemName: "exclamationmark.triangle")
            .foregroundStyle(.secondary)
        }

        if retryError?.needsAccount != true {
          Button {
            Task { await retry() }
          } label: {
            Text("Try again", tableName: "Onboarding", comment: "Starts a failed run again")
          }
          .disabled(isRetrying)
        }
      }

      if let retryError {
        GoalErrorSection(error: retryError)
      }
    }
  }

  private func retry() async {
    isRetrying = true
    retryError = nil
    defer { isRetrying = false }

    do {
      onDraft(try await onboarding.readAgain(id: draft.id))
    } catch is CancellationError {
      // The write is obsolete: the learner who asked is gone, so nothing shows.
    } catch {
      retryError = GoalError.starting(error)
    }
  }

  /// The run's stream ended: read the draft. A stream that ended before the draft was saved reads it again a moment later.
  private func reload() async {
    for attempt in 0..<5 {
      if let fresh = try? await onboarding.understanding(id: draft.id),
        fresh.status != .understanding
      {
        onDraft(fresh)
        return
      }

      try? await Task.sleep(for: .seconds(attempt + 1))
    }
  }
}

/// What the learner typed, as they typed it, above what's being read.
struct TypedGoalSection: View {
  let goal: String

  var body: some View {
    Section {
      Text(goal)
        .textSelection(.enabled)
    } header: {
      Text(
        "What you wrote", tableName: "Onboarding", comment: "Header over the learner's typed goal")
    }
  }
}

/// The wait while typed words are read: the words, then how far reading them got.
private struct UnderstandingWaitView: View {
  let goal: String
  /// The run reading them; nil right after sending, before the draft exists.
  let generationID: String?
  let onEnd: () async -> Void

  var body: some View {
    GenerationWaitView(
      title: LocalizedStringResource(
        "Understanding your goal", table: "Onboarding",
        comment: "Title while a typed goal is read"),
      description: LocalizedStringResource(
        "Next, you check what we understood.", table: "Onboarding",
        comment: "Shown while a typed goal is read"),
      generationID: generationID,
      kind: .understanding,
      onEnd: onEnd
    ) {
      TypedGoalSection(goal: goal)
    }
  }
}

extension View {
  /// The ✕ that leaves a task screen; what was answered so far is kept.
  func closesTask() -> some View {
    modifier(CloseTaskButton())
  }
}

/// Closes the task through the router: inside a pushed page, `dismiss` would only pop the page.
private struct CloseTaskButton: ViewModifier {
  @Environment(AppRouter.self) private var router

  func body(content: Content) -> some View {
    content.toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button(role: .close) {
          router.dismissTask()
        }
      }
    }
  }
}
