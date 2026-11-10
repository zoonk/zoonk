import SwiftUI

struct GoalSetupScreen: View {
  let goalId: String

  var body: some View {
    NavigationStack {
      GoalSetupContent(goalID: goalId)
    }
  }
}

/// A screen that comes back shows the same step, since each answer is saved.
struct GoalSetupContent: View {
  /// Inside the start flow, starting over goes back to its box; opened on its own, the start flow opens.
  var onStartOver: (() -> Void)?

  @State private var goalID: String

  @Environment(OnboardingStore.self) private var onboarding

  init(goalID: String, onStartOver: (() -> Void)? = nil) {
    self.onStartOver = onStartOver
    _goalID = State(initialValue: goalID)
  }

  var body: some View {
    let resource = onboarding.onboarding(goalID: goalID)

    Group {
      switch resource.state {
      case .loaded(let view):
        GoalSteps(view: view, onStartOver: onStartOver) { goalID = $0 }
          .id(view.goal.id)
      case .failed:
        ContentUnavailableView {
          Text(
            "We couldn't load your goal", tableName: "Onboarding",
            comment: "A goal's onboarding failed to load")
        } actions: {
          Button {
            Task { await resource.refresh() }
          } label: {
            Text("Try again", tableName: "Onboarding", comment: "Loads the goal's onboarding again")
          }
        }
        .lonePage()
        .closesTask()
      case .idle, .loading, .empty:
        StepLoading()
          .closesTask()
          .toolbar(removing: .title)
      }
    }
    .navigationTitle(Text("Your plan", tableName: "Onboarding", comment: "Title of a new plan"))
    .toolbarTitleDisplayMode(.inline)
    .loads(resource, refreshable: false)
  }
}

/// On the background the steps' forms have, so going from one step to the next doesn't flash white.
struct StepLoading: View {
  var body: some View {
    ProgressView()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(.systemBackground))
  }
}

/// The screens Back returns to: placement sits between the questions; the plan isn't one.
private let stepScreens: Set<Components.Schemas.OnboardingStep> = [
  .purpose, .role, .reason, .target, .targetDate, .followUps, .examChoice, .level, .schedule,
  .buddy, .placement, .work, .tools, .studies, .watch, .listen, .play, .read, .activities,
  .conditions, .learningSupport,
]

extension [Components.Schemas.OnboardingStep] {
  /// Core's `hasOnboardingQuestions`: About you screens are never setup still owed.
  var hasSetupQuestions: Bool {
    contains { $0 != .plan && $0.profileQuestion == nil }
  }
}

/// Where the learner is among the goal's setup questions.
struct SetupProgress: Equatable {
  let step: Int
  let total: Int
}

extension SetupProgress {
  /// Placement is optional, so it never counts: the total can't jump when a beginner skips it.
  private static let questions = stepScreens.subtracting([.placement])

  /// Nil on a screen that isn't one of the questions, placement included. The About you screens
  /// count as one, so the count keeps its scale.
  init?(
    current: Components.Schemas.OnboardingStep, history: [Components.Schemas.OnboardingStep],
    steps: [Components.Schemas.OnboardingStep]
  ) {
    self.init(current: current, history: history, steps: steps) { step in
      let counted = step.profileQuestion == nil ? step : .work
      return Self.questions.contains(counted) ? counted : nil
    }
  }

  /// "About you · 4 of 10": where an About you screen is among this run's.
  static func aboutYou(
    current: Components.Schemas.OnboardingStep, history: [Components.Schemas.OnboardingStep],
    steps: [Components.Schemas.OnboardingStep]
  ) -> SetupProgress? {
    SetupProgress(current: current, history: history, steps: steps) {
      $0.profileQuestion == nil ? nil : $0
    }
  }

  private init?(
    current: Components.Schemas.OnboardingStep, history: [Components.Schemas.OnboardingStep],
    steps: [Components.Schemas.OnboardingStep],
    counting: (Components.Schemas.OnboardingStep) -> Components.Schemas.OnboardingStep?
  ) {
    guard let current = counting(current) else {
      return nil
    }

    // Each question counts once, where the learner meets it: an earlier one opened again from a
    // later screen keeps its place, and the screen it was opened from is still ahead.
    let ahead = steps.compactMap(counting)
    let behind = history.compactMap(counting).filter { $0 == current || !ahead.contains($0) }

    var seen = Set<Components.Schemas.OnboardingStep>()
    let order = (behind + [current] + ahead).filter { seen.insert($0).inserted }
    self.init(step: (order.firstIndex(of: current) ?? 0) + 1, total: order.count)
  }
}

private struct GoalSteps: View {
  let view: GoalOnboarding
  let onStartOver: (() -> Void)?
  /// "Pass an exam" moved a language goal to an exam goal: the steps go on at the new goal.
  let onGoalMoved: (String) -> Void

  /// Read as the goal arrives, not in `body`, which runs on every save, failure and dialog.
  private let planFacts: [PlanFact]
  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(WarmUpStore.self) private var warmUps
  @State private var history: [Components.Schemas.OnboardingStep]
  /// A step the learner went Back to, or opened from a later one; nil follows the next step the
  /// server says.
  @State private var revisiting: Components.Schemas.OnboardingStep?
  @State private var scheduleDraft: ScheduleQuestion.Draft?
  @State private var isSaving = false
  @State private var failed = false
  /// Why the last save was refused, when the answer itself was.
  @State private var refusal: OnboardingError?
  @State private var confirmingStartOver = false
  /// Start over's request, cancelled if the screen goes away first, so it never acts after.
  @State private var startingOver: Task<Void, Never>?
  /// The conditions picked, consented or not, kept on this device only to check what often helps
  /// on the screen after.
  @State private var conditionPicks: [String] = []

  init(
    view: GoalOnboarding,
    onStartOver: (() -> Void)?,
    onGoalMoved: @escaping (String) -> Void
  ) {
    self.view = view
    self.onStartOver = onStartOver
    self.onGoalMoved = onGoalMoved
    _history = State(initialValue: Self.answeredSteps(view))
    planFacts = PlanFact.all(
      of: view.goal, today: GoalDate.today(now: .now, timeZone: view.goal.timezone))
  }

  private var step: Components.Schemas.OnboardingStep {
    revisiting ?? view.steps.first ?? .plan
  }

  @ViewBuilder private var moreActions: some View {
    Group {
      Button {
        router.dismissTask()
      } label: {
        Text(
          "Finish later", tableName: "Onboarding",
          comment: "Leaves onboarding, keeping the answers")
        Text("Your answers are kept", tableName: "Onboarding", comment: "Under Finish later")
      }

      if step.profileQuestion != nil {
        Button {
          answer(["forever": true, "question": "skipProfile"])
        } label: {
          Text(
            "Don't ask me these again", tableName: "AboutYou",
            comment: "Declines every About you question not answered yet")
          Text(
            "You can still answer them anytime in Settings › About you.", tableName: "AboutYou",
            comment: "Under Don't ask me these again")
        }
      }

      Button(role: .destructive) {
        confirmingStartOver = true
      } label: {
        Text(
          "Start over", tableName: "Onboarding",
          comment: "Clears this goal's answers and starts again")
        Text("Clears your answers", tableName: "Onboarding", comment: "Under Start over")
      }
    }
    .disabled(isSaving)
  }

  private var progress: SetupProgress? {
    SetupProgress(current: step, history: history, steps: view.steps)
  }

  var body: some View {
    StepScreen(
      step: step, view: view, isSaving: isSaving, failed: failed, refusal: refusal,
      scheduleDraft: scheduleDraft,
      profile: profile,
      onAnswer: { answer($0) },
      onChangeDate: changeDate,
      onPlacementDone: finishPlacement,
      onStartLesson: startLesson,
      onPickConditions: { conditionPicks = $0 }
    )
    .environment(\.onboardingAside, .planSoFar(planFacts))
    .id(step)
    .navigationBarBackButtonHidden()
    // The step counter takes the title's place; without it the bar shows no title.
    .toolbar(removing: progress == nil ? .title : nil)
    .taskOptions(
      isShown: step != .plan,
      label: Text("More", tableName: "Onboarding", comment: "Opens onboarding's menu")
    ) {
      moreActions
    }
    .toolbar {
      if !history.isEmpty, step != .plan {
        ToolbarItem(placement: .navigation) {
          Button(action: back) {
            Label {
              Text("Back", tableName: "Onboarding", comment: "Goes back to the previous question")
            } icon: {
              Image(systemName: "chevron.backward")
            }
          }
          .disabled(isSaving)
        }
      }

      if step.profileQuestion != nil {
        ToolbarItem(placement: .primaryAction) {
          Button {
            answer(["question": "skipProfile"])
          } label: {
            Text(
              "Skip all", tableName: "AboutYou",
              comment: "Skips the rest of the About you questions")
          }
          .accessibilityLabel(
            Text(
              "Skip the rest of the questions about you", tableName: "AboutYou",
              comment: "VoiceOver name of Skip all")
          )
          .disabled(isSaving)
        }
      }

      if let progress {
        ToolbarItem(placement: .principal) {
          Text(
            "Step \(progress.step) of \(progress.total)", tableName: "Onboarding",
            comment: "Where the learner is among the goal's questions"
          )
          .typeStyle(.data)
          .foregroundStyle(.secondary)
        }
      }

      // As on main, Back takes the ✕'s place once there's a step to go back to; "Finish later" stays in the menu.
      if history.isEmpty || step == .plan {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            router.dismissTask()
          }
        }
      }
    }
    .confirmationDialog(
      Text(
        "Start over?", tableName: "Onboarding", comment: "Asks before clearing a goal's answers"),
      isPresented: $confirmingStartOver, titleVisibility: .visible
    ) {
      Button(role: .destructive) {
        startingOver = Task { await startOver() }
      } label: {
        Text(
          "Start over", tableName: "Onboarding",
          comment: "Clears this goal's answers and starts again")
      }
    } message: {
      Text(
        "Your answers for this goal are cleared, and you type a goal again.",
        tableName: "Onboarding",
        comment: "What starting over does")
    }
    .onDisappear { startingOver?.cancel() }
    .taskThroughPush(id: view.generationId) { await preloadDeck() }
  }

  /// While the learner answers, so the quiz is there as soon as a wait opens.
  private func preloadDeck() async {
    guard let generationID = view.generationId,
      let deckID = await onboarding.followDeck(generationID: generationID)
    else {
      return
    }

    UsageAnalytics.track(
      .onboardingProgressed(
        .deckReceived(goalID: view.goal.id, onboardingID: view.onboardingID, deckID: deckID),
        at: .now))
    await warmUps.deck(id: deckID).load()
  }

  /// One answer saves at a time; a save that fails keeps the learner on this screen with what they
  /// picked. `then` runs once it's saved.
  private func answer(_ input: [String: Any], then: (() -> Void)? = nil) {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        try await save(input)
        then?()
      } catch is CancellationError {
      } catch {
        failed = true
        refusal = error as? OnboardingError
      }
    }
  }

  /// Lesson 1 from an About you screen, after saving its answer when it holds one. The questions
  /// not reached yet are asked when the learner comes back.
  private func startLesson(_ input: [String: Any]?) {
    guard let lesson = view.firstLesson else {
      return
    }

    let open = { router.open(.lesson(lessonId: lesson.id)) }

    if let input {
      answer(input, then: open)
    } else {
      open()
    }
  }

  /// The About you screen on show, with what it opens on.
  private var profile: ProfileStepModel? {
    guard let question = step.profileQuestion,
      let saved = view.profile.questions.first(where: { $0.id == question })
    else {
      return nil
    }

    let memoryEnabled = view.profile.memoryEnabled
    var draft = ProfileDraft(saved, memoryEnabled: memoryEnabled)
    var context = ProfileScreenContext(
      eyebrow: SetupProgress.aboutYou(current: step, history: history, steps: view.steps).map {
        String(
          localized: "About you · \($0.step) of \($0.total)", table: "AboutYou",
          comment: "Over an About you question in onboarding: which one it is of how many")
      },
      memoryEnabled: memoryEnabled)

    switch question {
    case .work where draft.text.isEmpty:
      if let role = currentRole {
        draft.text = role
        context.jobFromEarlierAnswer = true
      }
    case .conditions:
      let next = view.steps.firstIndex(of: step).map { view.steps.dropFirst($0 + 1).first }
      context.supportIsNext = next == .learningSupport
    case .learningSupport where history.last == .conditions:
      context.prechecked = draft.precheck(for: conditionPicks)
    default:
      break
    }

    return ProfileStepModel(question: saved, draft: draft, context: context)
  }

  /// The goal's current role, never the one a career change aims for.
  private var currentRole: String? {
    struct Details: Decodable {
      let role: String?
    }

    let role = (try? PracticeJSON.recode(view.goal.details, as: Details.self))?.role?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return role?.isEmpty == false ? String(role?.prefix(80) ?? "") : nil
  }

  private func finishPlacement() async throws {
    isSaving = true
    defer { isSaving = false }

    try await save(["question": "placement"])
  }

  private func save(_ input: [String: Any]) async throws {
    let answered = step
    let answer = try JSONDecoder().decode(
      OnboardingAnswer.self, from: JSONSerialization.data(withJSONObject: input))
    let updated = try await onboarding.answer(answer, goalID: view.goal.id)
    history.append(answered)
    revisiting = nil

    // Reaching a screen already in the history returns to it as it was, so Back skips the
    // questions opened from it.
    if let seen = history.firstIndex(of: updated.steps.first ?? .plan) {
      history.removeSubrange(seen...)
    }

    if updated.goal.id != view.goal.id {
      onGoalMoved(updated.goal.id)
    }
  }

  private func back() {
    guard let previous = history.popLast() else {
      return
    }

    // What the time question kept for a date change is stale once the learner leaves it by Back.
    if step == .schedule {
      scheduleDraft = nil
    }

    failed = false
    revisiting = previous
  }

  /// Back returns to the time question, and so does the date's answer, after any question it raises.
  private func changeDate(_ draft: ScheduleQuestion.Draft) {
    scheduleDraft = draft
    history.append(step)
    failed = false
    revisiting = .targetDate
  }

  private func startOver() async {
    isSaving = true
    defer { isSaving = false }

    do {
      try await onboarding.startOver(goalIDs: view.goalIds.isEmpty ? [view.goal.id] : view.goalIds)

      // Closed meanwhile: whatever is on screen now isn't this setup's to replace.
      guard !Task.isCancelled else {
        return
      }

      if let onStartOver {
        onStartOver()
      } else if case .goalSetup = router.tasks.last {
        // Only the setup that asked is replaced, if it's still the one on screen.
        router.dismissTask()
        router.open(.startGoal())
      }
    } catch is CancellationError {
    } catch {
      failed = true
    }
  }

  /// So Back returns to them after coming back later.
  private static func answeredSteps(_ view: GoalOnboarding) -> [Components.Schemas.OnboardingStep] {
    struct Details: Decodable {
      let answered: [String]?
    }

    let answered =
      (try? PracticeJSON.recode(view.goal.details, as: Details.self))?.answered ?? []

    return answered.compactMap(Components.Schemas.OnboardingStep.init(rawValue:))
      .filter(stepScreens.contains)
  }
}

/// What an About you step opens on.
private struct ProfileStepModel {
  let question: ProfileQuestionView
  let draft: ProfileDraft
  let context: ProfileScreenContext
}

private struct StepScreen: View {
  let step: Components.Schemas.OnboardingStep
  let view: GoalOnboarding
  let isSaving: Bool
  let failed: Bool
  let refusal: OnboardingError?
  let scheduleDraft: ScheduleQuestion.Draft?
  let profile: ProfileStepModel?
  let onAnswer: ([String: Any]) -> Void
  let onChangeDate: (ScheduleQuestion.Draft) -> Void
  let onPlacementDone: () async throws -> Void
  let onStartLesson: ([String: Any]?) -> Void
  let onPickConditions: ([String]) -> Void

  var body: some View {
    if let profile {
      ProfileStep(
        view: view, question: profile.question, context: profile.context, draft: profile.draft,
        isSaving: isSaving, failed: failed, onAnswer: onAnswer, onStartLesson: onStartLesson,
        onPickConditions: onPickConditions
      )
      .onboardingColumn()
      .questionShown(step, of: view)
    } else {
      screen
    }
  }

  @ViewBuilder private var screen: some View {
    switch step {
    case .placement:
      Group {
        if view.goal.kind == .language, let targetLanguage = view.goal.targetLanguage {
          LevelTestStep(
            goalID: view.goal.id, language: view.goal.language, targetLanguage: targetLanguage,
            testMinutes: view.quickTestMinutes, onDone: onPlacementDone)
        } else {
          PlacementStep(view: view, subject: subject, onDone: onPlacementDone)
        }
      }
      .questionShown(step, of: view)
    case .plan:
      PlanStep(view: view)
    case .schedule:
      ScheduleQuestion(
        view: view, draft: scheduleDraft, isSaving: isSaving, failed: failed, refusal: refusal,
        onAnswer: onAnswer, onChangeDate: onChangeDate
      )
    default:
      QuestionStep(
        step: step, view: view, subject: subject, isSaving: isSaving, failed: failed,
        onAnswer: onAnswer
      )
      .onboardingColumn()
      .questionShown(step, of: view)
    }
  }

  private var subject: String {
    struct Details: Decodable {
      let subject: String?
    }

    let subject = (try? PracticeJSON.recode(view.goal.details, as: Details.self))?.subject
    return subject?.trimmingCharacters(in: .whitespaces).isEmpty == false
      ? subject ?? view.goal.title : view.goal.title
  }
}

extension View {
  /// Main's `OnboardingQuestionShown`: a question the learner sees, each time it comes on screen.
  func questionShown(_ step: Components.Schemas.OnboardingStep, of view: GoalOnboarding)
    -> some View
  {
    onAppear {
      UsageAnalytics.track(
        .onboardingProgressed(
          .questionShown(
            goalID: view.goal.id, onboardingID: view.onboardingID, question: step.rawValue),
          at: .now))
    }
  }
}
