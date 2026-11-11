import SwiftUI

/// A guest whose one goal is taken is asked to create an account before typing anything.
struct GoalStartScreen: View {
  /// Words a link or another screen filled in; the learner sends them.
  var goal: String?
  /// A goal typed before and not confirmed yet, opened where it was left.
  var draftID: String?

  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(SettingsStore.self) private var settings

  var body: some View {
    GoalStartFlow(
      sentGoal: onboarding.sentGoal, prefill: goal, draftID: draftID, needsAccount: needsAccount,
      limit: settings.allowance.value?.goalStartLimit, room: settings.allowance.value?.activeGoals
    )
    .loads(settings.allowance, refreshable: false)
  }

  private var needsAccount: Bool {
    guard let summary = learner.summary.value else {
      return false
    }

    return summary.identity.isAnonymous && !summary.followedGoals.isEmpty
  }
}

extension PlanAllowance {
  /// Said before the learner types, checked in core's order; creating a goal checks it again.
  var goalStartLimit: GoalLimitReason? {
    let reached: (period: String, resource: String)? =
      if activeGoals.isReached {
        ("total", "activeGoals")
      } else if newGoalsTotal.isReached {
        ("total", "goal")
      } else if newGoalsToday.isReached {
        ("day", "goal")
      } else if newGoalsThisMonth.isReached {
        ("month", "goal")
      } else {
        nil
      }

    return reached.map {
      GoalLimitReason(
        OnboardingLimit(period: $0.period, resource: $0.resource, tier: tier.rawValue))
    }
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
    .lonePage()
  }
}

private enum StartPage: Hashable {
  case draft
  case questions
}

private enum DraftState {
  case opening(id: String)
  case sending(String)
  case draft(OnboardingDraft, sentHere: Bool)
}

private struct GoalStartFlow: View {
  let limit: GoalLimitReason?
  /// Goals followed at once against the plan's cap. Signing up, Plus or pausing a goal changes it,
  /// and a draft whose room disagrees is read again.
  let room: PlanAllowance.Cap?
  /// Decided when the flow opens: the goal this flow creates mustn't turn it into the gate.
  @State private var needsAccount: Bool

  @Environment(OnboardingStore.self) private var onboarding
  @State private var path: [StartPage] = []
  @State private var words: String
  @State private var error: GoalError?
  @State private var draft: DraftState?
  @State private var goalID: String?
  @State private var sending: Task<Void, Never>?
  /// Each sending of the goal's words, which joins its events before the goal exists.
  @State private var attemptID: String?
  @State private var material: [AttachedSource] = []
  @State private var intent: MaterialIntent?
  @State private var materialDraft = MaterialDraft()

  init(
    sentGoal: SentGoal?, prefill: String?, draftID: String?, needsAccount: Bool,
    limit: GoalLimitReason?, room: PlanAllowance.Cap?
  ) {
    self.limit = limit
    self.room = room
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
      if let draftID {
        _draft = State(initialValue: .opening(id: draftID))
        _path = State(initialValue: [.draft])
      }
    }
  }

  var body: some View {
    if needsAccount {
      NavigationStack {
        GuestGoalGate()
          .closesTask()
          .barName(title)
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
        ZoonkList {
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
            attach: {
              GoalMaterialButton(material: $material, draft: $materialDraft)
            },
            attachment: {
              GoalMaterialSections(material: $material, intent: $intent, draft: $materialDraft)
            })
        }
        .onboardingColumn()
        .closesTask()
        .barName(title)
        .navigationDestination(for: StartPage.self) { page in
          Group {
            switch page {
            case .draft:
              draftPage
                .environment(\.opensPlanAsSheet, true)
            case .questions:
              MaterialQuestionsView(sources: material)
            }
          }
          .onboardingColumn()
          .closesTask()
          .barName(title)
        }
      }
      .environment(\.onboardingAside, .howItWorks)
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
      .onChange(of: room) { _, room in
        if let room, case .draft(let value, let sentHere) = draft,
          value.activeGoalsLeft != room.left
        {
          Task { await reread(value, sentHere: sentHere) }
        }
      }
      .onDisappear {
        sending?.cancel()
      }
    }
  }

  private var title: Text {
    Text(
      "Start with your goal", tableName: "Onboarding",
      comment: "Names the start flow's screens, whose own titles head them")
  }

  @ViewBuilder
  private var draftPage: some View {
    switch draft {
    case .opening(let id):
      ZoonkList {
        ProgressView()
          .frame(maxWidth: .infinity)
          .listRowBackground(Color.clear)
      }
      .task(id: id) {
        await open(id)
      }
    case .sending(let goal):
      UnderstandingWaitView(goal: goal, generationID: nil, attemptID: attemptID) { true }
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

  /// One that can't be read leaves the box empty, as main's start page does.
  private func open(_ id: String) async {
    do {
      show(try await onboarding.understanding(id: id), sentHere: false)
    } catch {
      if !Task.isCancelled {
        path = []
      }
    }
  }

  /// The card stays as it was when the read fails, and a read that lands after the learner left
  /// it is dropped.
  private func reread(_ shown: OnboardingDraft, sentHere: Bool) async {
    guard let value = try? await onboarding.understanding(id: shown.id),
      case .draft(let current, _) = draft, current.id == value.id
    else {
      return
    }

    show(value, sentHere: sentHere)
  }

  /// One saved as a goal meanwhile goes on with that goal's setup.
  private func show(_ value: OnboardingDraft, sentHere: Bool) {
    if let goalID = value.goalId {
      self.goalID = goalID
    } else {
      words = value.prompt
      draft = .draft(value, sentHere: sentHere)
    }
  }

  private func send(_ goal: String) {
    let attempt = UUID().uuidString.lowercased()
    attemptID = attempt
    UsageAnalytics.track(
      .goalTyped(hasAttachment: !material.isEmpty, attemptID: attempt, submittedAt: .now))
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
        // A late reply still links an attempt the learner left.
        UsageAnalytics.track(
          .onboardingProgressed(
            .attemptLinked(attemptID: attempt, onboardingID: value.id), at: .now))

        guard !Task.isCancelled else {
          return
        }

        draft = .draft(value, sentHere: true)
      } catch is CancellationError {
        // The session changed meanwhile.
        if !Task.isCancelled {
          path = []
        }
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
        goal: draft.prompt, generationID: draft.generationId, onboardingID: draft.id,
        readResult: reload)
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
    ZoonkList {
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
      SectionTitle(
        Text(
          "What you wrote", tableName: "Onboarding", comment: "Header over the learner's typed goal"
        ))
    }
  }
}

private struct UnderstandingWaitView: View {
  let goal: String
  /// The run reading them; nil right after sending, before the draft exists.
  let generationID: String?
  var attemptID: String?
  var onboardingID: String?
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
      }
    )
    .measuresWait(
      surface: "understanding", contentKind: "curriculum", attemptID: attemptID,
      onboardingID: onboardingID)
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
