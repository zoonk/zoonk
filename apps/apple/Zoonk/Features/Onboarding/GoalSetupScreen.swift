import SwiftUI

/// A goal's own onboarding as a full-screen task (`/start/[goalId]`), opened from Today while a goal's questions are left.
struct GoalSetupScreen: View {
  let goalId: String

  var body: some View {
    NavigationStack {
      GoalSetupContent(goalID: goalId)
    }
  }
}

/// The questions the typed goal didn't answer, one per screen with Back and a way to start over, then placement and the plan. A screen that comes back shows the same step, since each answer is saved.
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
        .closesTask()
      case .idle, .loading, .empty:
        ProgressView()
          .closesTask()
      }
    }
    .loads(resource, refreshable: false)
  }
}

/// The screens that count as steps in the counter: placement sits between the questions; the plan isn't one.
private let stepScreens: Set<Components.Schemas.OnboardingStep> = [
  .purpose, .role, .reason, .target, .targetDate, .followUps, .examChoice, .level, .schedule,
  .buddy, .placement,
]

private struct GoalSteps: View {
  let view: GoalOnboarding
  let onStartOver: (() -> Void)?
  /// "Pass an exam" moved a language goal to an exam goal: the steps go on at the new goal.
  let onGoalMoved: (String) -> Void

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @State private var history: [Components.Schemas.OnboardingStep]
  /// A step the learner went Back to; nil follows the next step the server says.
  @State private var revisiting: Components.Schemas.OnboardingStep?
  @State private var isSaving = false
  @State private var failed = false
  @State private var confirmingStartOver = false

  init(
    view: GoalOnboarding,
    onStartOver: (() -> Void)?,
    onGoalMoved: @escaping (String) -> Void
  ) {
    self.view = view
    self.onStartOver = onStartOver
    self.onGoalMoved = onGoalMoved
    _history = State(initialValue: Self.answeredSteps(view))
  }

  private var step: Components.Schemas.OnboardingStep {
    revisiting ?? view.steps.first ?? .plan
  }

  var body: some View {
    StepScreen(
      step: step, view: view, isSaving: isSaving, failed: failed, onAnswer: answer,
      onPlacementDone: { answer(["question": "placement"]) }
    )
    .id(step)
    .navigationBarBackButtonHidden()
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

      if let progress {
        ToolbarItem(placement: .principal) {
          Text(
            "Step \(progress.current) of \(progress.total)", tableName: "Onboarding",
            comment: "Where the learner is among the goal's questions"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .monospacedDigit()
        }
      }

      if step != .plan {
        ToolbarItem(placement: .primaryAction) {
          Menu {
            Button {
              router.dismissTask()
            } label: {
              Text(
                "Finish later", tableName: "Onboarding",
                comment: "Leaves onboarding, keeping the answers")
              Text("Your answers are kept", tableName: "Onboarding", comment: "Under Finish later")
            }

            Button(role: .destructive) {
              confirmingStartOver = true
            } label: {
              Text(
                "Start over", tableName: "Onboarding",
                comment: "Clears this goal's answers and starts again")
              Text("Clears your answers", tableName: "Onboarding", comment: "Under Start over")
            }
          } label: {
            Label {
              Text("More", tableName: "Onboarding", comment: "Opens onboarding's menu")
            } icon: {
              Image(systemName: "ellipsis")
            }
          }
          .disabled(isSaving)
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
        Task { await startOver() }
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
  }

  /// The step counter beside the bar: answered steps, this one and the ones still ahead.
  private var progress: (current: Int, total: Int)? {
    guard stepScreens.contains(step) else {
      return nil
    }

    let answered = history.filter(stepScreens.contains).count
    let remaining = view.steps.filter { $0 != step && stepScreens.contains($0) }.count
    return (answered + 1, answered + 1 + remaining)
  }

  /// One answer saves at a time; a save that fails keeps the learner on this screen with what they picked.
  private func answer(_ input: [String: Any]) {
    guard !isSaving else {
      return
    }

    let answered = step
    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        let answer = try JSONDecoder().decode(
          OnboardingAnswer.self, from: JSONSerialization.data(withJSONObject: input))
        let updated = try await onboarding.answer(answer, goalID: view.goal.id)
        history.append(answered)
        revisiting = nil

        if updated.goal.id != view.goal.id {
          onGoalMoved(updated.goal.id)
        }
      } catch {
        failed = true
      }
    }
  }

  private func back() {
    guard let previous = history.popLast() else {
      return
    }

    failed = false
    revisiting = previous
  }

  /// Archives what this onboarding created and goes back to typing a goal.
  private func startOver() async {
    isSaving = true
    defer { isSaving = false }

    do {
      try await onboarding.startOver(goalIDs: view.goalIds.isEmpty ? [view.goal.id] : view.goalIds)

      if let onStartOver {
        onStartOver()
      } else {
        router.dismissTask()
        router.open(.startGoal())
      }
    } catch {
      failed = true
    }
  }

  /// The steps already answered, in order, so Back returns to them after coming back later.
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

/// The screen for one step. Each answer goes back through the flow.
private struct StepScreen: View {
  let step: Components.Schemas.OnboardingStep
  let view: GoalOnboarding
  let isSaving: Bool
  let failed: Bool
  let onAnswer: ([String: Any]) -> Void
  let onPlacementDone: () -> Void

  var body: some View {
    switch step {
    case .placement:
      if view.goal.kind == .language, let targetLanguage = view.goal.targetLanguage {
        LevelTestStep(goalID: view.goal.id, targetLanguage: targetLanguage, onDone: onPlacementDone)
      } else {
        PlacementStep(view: view, subject: subject, onDone: onPlacementDone)
      }
    case .plan:
      PlanStep(view: view)
    default:
      QuestionStep(
        step: step, view: view, subject: subject, isSaving: isSaving, failed: failed,
        onAnswer: onAnswer)
    }
  }

  /// How the questions name the goal: its subject, such as "quantum physics", or its title.
  private var subject: String {
    struct Details: Decodable {
      let subject: String?
    }

    let subject = (try? PracticeJSON.recode(view.goal.details, as: Details.self))?.subject
    return subject?.trimmingCharacters(in: .whitespaces).isEmpty == false
      ? subject ?? view.goal.title : view.goal.title
  }
}
