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
      limit: settings.allowance.value?.goalStartLimit
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
    let reached: (period: String, resource: String, availableAt: Date?)? =
      if activeGoals.isReached {
        ("total", "activeGoals", nil)
      } else if newGoalsTotal.isReached {
        ("total", "goal", nil)
      } else if newGoalsToday.isReached {
        ("day", "goal", nil)
      } else if newGoalsMonthly.isReached {
        ("rolling30Days", "goal", newGoalsMonthly.availableAt)
      } else {
        nil
      }

    return reached.map {
      GoalLimitReason(
        OnboardingLimit(
          period: $0.period, resource: $0.resource, tier: tier.rawValue,
          availableAt: $0.availableAt?.ISO8601Format()))
    }
  }
}

private struct GuestGoalGate: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    StateMessage {
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
        Text("Today", tableName: "Onboarding", comment: "Leaves the start flow for Today")
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
  case sending(String)
  case draft(id: String, sentHere: Bool)
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
  /// Each sending of the goal's words, which joins its events before the goal exists.
  @State private var attemptID: String?
  @State private var material: [AttachedSource] = []
  @State private var intent: MaterialIntent?
  @State private var materialDraft = MaterialDraft()

  init(
    sentGoal: SentGoal?, prefill: String?, draftID: String?, needsAccount: Bool,
    limit: GoalLimitReason?
  ) {
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
      if let draftID {
        _draft = State(initialValue: .draft(id: draftID, sentHere: false))
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
          if let gate = limitGate {
            StepHeader(title: gate.title, description: gate.line)
              .announcesAlert(gate.said)
          } else {
            StepHeader(
              title: Text("What's your goal?", tableName: "Onboarding"),
              description: Text(
                "Tell us in your own words. We'll build the plan.", tableName: "Onboarding",
                comment: "Under the start flow's first title"))

            GoalEntrySections(
              words: $words, error: error,
              canSubmitEmpty: !material.isEmpty && intent != nil,
              materialDraft: $materialDraft,
              onSubmit: submit,
              attach: {
                GoalMaterialButton(material: $material, draft: $materialDraft)
              },
              attached: {
                GoalMaterialChips(material: $material)
              },
              attachment: {
                GoalMaterialSections(material: $material, intent: $intent, draft: $materialDraft)
              })
          }
        }
        .bottomBar {
          if limitGate != nil {
            GoalLimitActions(limit: .activeGoals)
          }
        }
        .onboardingColumn()
        .closesTask()
        .barName(title)
        .navigationDestination(for: StartPage.self) { page in
          Group {
            switch page {
            case .draft:
              draftPage
            case .questions:
              MaterialQuestionsView(sources: material)
            }
          }
          .onboardingColumn()
          // Its steps are a plan's, so an explanation offer goes without them.
          .environment(\.onboardingAside, page == .draft && offersExplanation ? nil : .howItWorks)
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
      .onChange(of: path) { previous, path in
        // A page over the entry ends its visit: how adding material went is gone, and an addition
        // still out says nothing when it lands. What was typed and pasted stays.
        if previous.isEmpty, !path.isEmpty {
          materialDraft.leave()
        }

        // Back from the draft: its words and material wait in the box, and nothing still being sent
        // shows up.
        if path.isEmpty {
          sending?.cancel()

          if let shown = shownDraft {
            edit(SentGoal(draft: shown))
          }

          draft = nil
        }
      }
      .onDisappear {
        materialDraft.leave()
        sending?.cancel()
      }
    }
  }

  /// Main's: at the goals studied at once, the screen is only the gate, with no box to type in. A
  /// month's new goals used up shows after a try.
  private var limitGate: GoalLimitGate? {
    limit == .activeGoals ? GoalLimitGate(limit, at: .now) : nil
  }

  private var title: Text {
    Text(
      "Start with your goal", tableName: "Onboarding",
      comment: "Names the start flow's screens, whose own titles head them")
  }

  private var offersExplanation: Bool {
    guard case .case2? = shownDraft?.understanding?.value1 else {
      return false
    }

    return true
  }

  private var shownDraft: OnboardingDraft? {
    guard case .draft(let id, _) = draft else {
      return nil
    }

    return onboarding.draft(id: id).value
  }

  @ViewBuilder
  private var draftPage: some View {
    switch draft {
    case .sending(let goal):
      UnderstandingWaitView(goal: goal, generationID: nil, attemptID: attemptID) { true }
    case .draft(let id, let sentHere):
      DraftView(
        card: onboarding.draft(id: id),
        sentHere: sentHere,
        onRewrite: rewrite,
        onBack: { path = [] },
        onGoal: { goalID = $0 })
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

  private func edit(_ goal: SentGoal) {
    words = goal.words
    material = goal.material
    intent = goal.intent
  }

  /// New words on a draft go with the material it was sent with.
  private func rewrite(_ words: String) {
    if let shown = shownDraft {
      edit(SentGoal(draft: shown))
    }

    self.words = words
    send(words)
  }

  private func send(_ goal: String) {
    let sent = SentGoal(words: goal, material: material, intent: intent).sentMaterial
    let attempt = UUID().uuidString.lowercased()
    attemptID = attempt
    UsageAnalytics.track(
      .goalTyped(hasAttachment: !material.isEmpty, attemptID: attempt, submittedAt: .now))
    sending?.cancel()
    error = nil
    draft = .sending(goal)

    if path.isEmpty {
      path = [.draft]
    }

    sending = Task {
      do {
        let id = try await onboarding.understand(goal: goal, material: sent)
        // A late reply still links an attempt the learner left.
        UsageAnalytics.track(
          .onboardingProgressed(.attemptLinked(attemptID: attempt, onboardingID: id), at: .now))

        guard !Task.isCancelled else {
          return
        }

        draft = .draft(id: id, sentHere: true)
      } catch is CancellationError {
        // The session changed meanwhile.
        if !Task.isCancelled {
          path = []
        }
      } catch OnboardingError.materialUnavailable(let ids) {
        guard !Task.isCancelled else {
          return
        }

        // Back at the box with the words, the choice and the material still there to send.
        material = material.marking(unavailable: ids)
        path = []
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

struct DraftView: View {
  let card: Resource<OnboardingDraft>
  let sentHere: Bool
  let onRewrite: (String) -> Void
  let onBack: () -> Void
  let onGoal: (String) -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var retryError: GoalError?
  @State private var isRetrying = false
  /// The visit's: one owner whatever the draft's read, so a read while its goal is made keeps Back
  /// waiting and the answer shows on the card the learner sees.
  @State private var creation = DraftCreation()

  var body: some View {
    Group {
      // One card for a draft read or being read again, its controls waiting while it is; a read
      // that fails offers to read it again.
      switch card.freshState {
      case .loaded,
        .loading where card.value != nil:
        card.value.map(page)
      case .failed:
        GoalLoadFailure {
          await card.refresh()
        }
      case .idle, .loading, .empty:
        ZoonkList {
          ProgressView()
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
      }
    }
    // Hiding the system's Back also stops the edge swipe; the one in its place says Back waits.
    .navigationBarBackButtonHidden(!creation.canLeave)
    .toolbar {
      if !creation.canLeave {
        ToolbarItem(placement: .topBarLeading) {
          Button {
          } label: {
            Label {
              Text("Back", tableName: "Onboarding", comment: "Goes back to the previous question")
            } icon: {
              Image(systemName: "chevron.backward")
            }
          }
          .disabled(true)
        }
      }
    }
    // One saved as a goal meanwhile goes on with that goal's setup.
    .onChange(of: card.value?.goalId, initial: true) { _, goalID in
      if let goalID {
        onGoal(goalID)
      }
    }
    .onDisappear { creation.leave(card) }
    .loads(card, refreshable: false)
  }

  @ViewBuilder
  private func page(_ draft: OnboardingDraft) -> some View {
    switch draft.status {
    case .unrecognized: EmptyView()
    case .understanding:
      UnderstandingWaitView(
        goal: draft.prompt, generationID: draft.generationId, onboardingID: draft.id,
        readResult: reload)
    case .failed:
      failed(draft)
    case .understood:
      ReadDraftView(
        card: card, draft: draft, creation: creation, sentHere: sentHere, onRewrite: onRewrite,
        onBack: onBack, onCreated: onGoal)
    }
  }

  /// Starting it again is new work, so it waits for the learner's tap.
  private func failed(_ draft: OnboardingDraft) -> some View {
    ZoonkList {
      LearnerBubble(words: draft.prompt)
        .listRowSeparator(.hidden)

      StepHeader(
        title: Text(
          "Understanding your goal", tableName: "Onboarding",
          comment: "Title while a typed goal is read"),
        description: nil)

      GenerationFailureSection(
        failure: .generation, isActing: isRetrying,
        act: retryError?.needsAccount == true ? nil : { Task { await retry(draft.id) } })

      if let retryError {
        GoalErrorSection(error: retryError)
      }
    }
  }

  private func retry(_ id: String) async {
    isRetrying = true
    retryError = nil
    defer { isRetrying = false }

    do {
      try await onboarding.readAgain(id: id)
    } catch is CancellationError {
    } catch {
      retryError = GoalError.starting(error)
    }
  }

  /// A run that ended before the draft was saved reads it again a moment later.
  private func reload() async -> Bool {
    for attempt in 0..<5 {
      await card.refresh()

      if let status = card.value?.status, status != .understanding {
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
        "Next, we'll show you what we understood.", table: "Onboarding"),
      generationID: generationID,
      kind: .understanding,
      readResult: readResult,
      leading: {
        LearnerBubble(words: goal)
          .listRowSeparator(.hidden)
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
    content.taskClose {
      Button(role: .close) {
        router.dismissTask()
      }
      .leavesOnEscape()
    }
  }
}
