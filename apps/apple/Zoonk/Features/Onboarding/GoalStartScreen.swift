import SwiftUI

/// A guest whose one goal is taken is asked to create an account before typing anything.
struct GoalStartScreen: View {
  /// Words a link or another screen filled in; the learner sends them.
  var goal: String?

  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    GoalStartFlow(
      sentGoal: onboarding.sentGoal, prefill: goal, needsAccount: needsAccount, limit: upFrontLimit)
  }

  private var needsAccount: Bool {
    guard let summary = learner.summary.value else {
      return false
    }

    return summary.identity.isAnonymous && !summary.followedGoals.isEmpty
  }

  /// Said before the learner types; creating a goal checks it again.
  private var upFrontLimit: GoalLimitReason? {
    guard let summary = learner.summary.value, summary.tier == .free,
      summary.followedGoals.contains(where: { $0.status == .active })
    else {
      return nil
    }

    return .oneActiveGoal
  }
}

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
  case questions
}

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
  @State private var material: [AttachedSource] = []
  @State private var intent: MaterialIntent?

  init(sentGoal: SentGoal?, prefill: String?, needsAccount: Bool, limit: GoalLimitReason?) {
    self.limit = limit
    _needsAccount = State(initialValue: needsAccount)
    _words = State(initialValue: sentGoal?.words ?? prefill ?? "")
    _material = State(initialValue: sentGoal?.material ?? [])
    _intent = State(initialValue: sentGoal?.intent)

    switch sentGoal?.start {
    case .goal(let goal):
      _draft = State(initialValue: .sending(goal))
      _path = State(initialValue: [.draft])
    case .questions:
      _path = State(initialValue: [.questions])
    case nil:
      break
    }
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

          GoalEntrySections(
            words: $words, error: error, limit: limit,
            canSubmitEmpty: !material.isEmpty && intent != nil,
            onSubmit: submit,
            attachment: {
              GoalMaterialSections(material: $material, intent: $intent)
            })
        }
        .onboardingColumn()
        .closesTask()
        .navigationDestination(for: StartPage.self) { page in
          switch page {
          case .draft:
            draftPage
              .onboardingColumn()
              .closesTask()
          case .questions:
            MaterialQuestionsView(sources: material)
              .onboardingColumn()
              .closesTask()
          }
        }
      }
      // Today's box sent the words with the tap that opened this screen.
      .task {
        if onboarding.takeSentGoal() != nil, case .sending(let goal) = draft {
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
      UnderstandingWaitView(goal: goal, generationID: nil) { true }
    case .draft(let value, let sentHere):
      DraftView(
        draft: value,
        sentHere: sentHere,
        onDraft: { draft = .draft($0, sentHere: sentHere) },
        onRewrite: send,
        onBack: { path = [] },
        onCreated: { goalID = $0 },
        sourceIDs: material.map(\.id))
    case nil:
      EmptyView()
    }
  }

  private func submit(_ typed: String) {
    switch SentGoal(words: typed, material: material, intent: intent).start {
    case .questions:
      path = [.questions]
    case .goal(let goal):
      send(goal)
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

private struct DraftView: View {
  let draft: OnboardingDraft
  let sentHere: Bool
  let onDraft: (OnboardingDraft) -> Void
  let onRewrite: (String) -> Void
  let onBack: () -> Void
  let onCreated: (String) -> Void
  let sourceIDs: [String]

  @Environment(OnboardingStore.self) private var onboarding
  @State private var retryError: GoalError?
  @State private var isRetrying = false

  var body: some View {
    switch draft.status {
    case .understanding:
      UnderstandingWaitView(
        goal: draft.prompt, generationID: draft.generationId, readResult: reload)
    case .failed:
      failed
    case .understood:
      ReadDraftView(
        draft: draft, sentHere: sentHere, onDraft: onDraft, onRewrite: onRewrite, onBack: onBack,
        onCreated: onCreated, sourceIDs: sourceIDs)
    }
  }

  /// Starting it again is new work, so it waits for the learner's tap.
  private var failed: some View {
    List {
      StepHeader(
        title: Text(
          "Understanding your goal", tableName: "Onboarding",
          comment: "Title while a typed goal is read"),
        description: nil)

      TypedGoalSection(goal: draft.prompt)

      GenerationFailureSection(
        failure: .generation, isActing: isRetrying,
        act: retryError?.needsAccount == true ? nil : { Task { await retry() } })

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
    } catch {
      retryError = GoalError.starting(error)
    }
  }

  /// A run that ended before the draft was saved reads it again a moment later.
  private func reload() async -> Bool {
    for attempt in 0..<5 {
      if let fresh = try? await onboarding.understanding(id: draft.id),
        fresh.status != .understanding
      {
        onDraft(fresh)
        return true
      }

      do {
        try await Task.sleep(for: .seconds(attempt + 1))
      } catch {
        return true
      }
    }

    return false
  }
}

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

private struct UnderstandingWaitView: View {
  let goal: String
  /// The run reading them; nil right after sending, before the draft exists.
  let generationID: String?
  let readResult: () async -> Bool

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
      readResult: readResult,
      leading: {
        TypedGoalSection(goal: goal)
      })
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
