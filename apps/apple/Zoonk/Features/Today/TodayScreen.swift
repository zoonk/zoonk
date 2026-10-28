import SwiftUI

/// Today, the screen learners open every day, with one job: start or continue today's session.
/// It owns every state main's Today has: a visitor or a learner without a goal starts one here, a
/// goal whose plan is being built waits, a paused goal says so, and otherwise the day.
struct TodayScreen: View {
  @Environment(SessionStore.self) private var session
  @Environment(TodayStore.self) private var store

  var body: some View {
    content
      .navigationTitle(Text("Today", tableName: "Today", comment: "Today tab's title"))
  }

  @ViewBuilder
  private var content: some View {
    if session.authenticatedSession == nil {
      TodayStartGoal()
    } else {
      signedIn
        .loads(store.today)
    }
  }

  @ViewBuilder
  private var signedIn: some View {
    switch store.today.state {
    case .loaded(.day(let view)):
      TodayDayView(view: view)
        // A new day (midnight, a goal switch) draws fresh: folds and busy taps were the old day's.
        .id("\(view.goal.id):\(view.session.localDate)")
    case .loaded(.noGoal(let suggestion)):
      if let suggestion {
        TodaySuggestedGoal(suggestion: suggestion)
      } else {
        TodayStartGoal()
      }
    case .loaded(.preparing(let goalID, let title)):
      TodayPreparing(goalID: goalID, title: title)
    case .loaded(.goalNotActive):
      TodayGoalPaused()
    case .failed(let error) where error != .unauthorized:
      ContentUnavailableView {
        Label {
          Text("Today didn't load", tableName: "Today", comment: "Today failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } description: {
        Text(
          "Check your connection and try again.", tableName: "Today",
          comment: "Today failed to load")
      } actions: {
        Button {
          Task { await store.today.refresh() }
        } label: {
          Text("Try again", tableName: "Today", comment: "Retries loading Today")
        }
        .buttonStyle(.bordered)
      }
    default:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

/// A visitor or a learner without a goal starts one right here, under Today's own title (S5b's
/// inline `GoalStartEntry`, as main's start form): an unfinished quick explanation first, then the
/// box with its examples.
private struct TodayStartGoal: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    List {
      if let explanation = learner.summary.value?.openExplanations.last {
        Section {
          Label {
            VStack(alignment: .leading, spacing: 2) {
              Text(explanation.title)
              Text("Quick explanation", tableName: "Today", comment: "An unfinished explanation")
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          } icon: {
            Image(systemName: "play")
              .foregroundStyle(.secondary)
          }

          Button {
            router.open(.explain(goalId: explanation.id))
          } label: {
            Text(
              "Continue explanation", tableName: "Today",
              comment: "Opens the learner's unfinished quick explanation")
          }
        } header: {
          Text(
            "Your quick explanation", tableName: "Today",
            comment: "The learner's unfinished quick explanation")
        }
      }

      GoalStartEntry()
    }
    .navigationSubtitle(Text(Date.now, format: .dateTime.weekday(.abbreviated).month().day()))
  }
}

/// A learner back from before goals existed: their last course is offered first, and either answer
/// moves them on.
private struct TodaySuggestedGoal: View {
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store

  let suggestion: SuggestedGoal

  @State private var answering: Bool?
  @State private var failed = false

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "Continue \(suggestion.title)?", tableName: "Today",
            comment: "Offers a goal from the learner's last course"
          )
          .font(.headline)

          Text("Build a plan in 1 minute.", tableName: "Today", comment: "Suggested goal's promise")
            .foregroundStyle(.secondary)
        }

        Button {
          answer(accepted: true)
        } label: {
          Text("Build my plan", tableName: "Today", comment: "Accepts the suggested goal")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        Button {
          answer(accepted: false)
        } label: {
          Text("Not now", tableName: "Today", comment: "Dismisses the suggested goal")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      } header: {
        Label {
          Text(
            "Suggested goal", tableName: "Today", comment: "A goal from the learner's last course")
        } icon: {
          Image(systemName: "safari")
        }
      } footer: {
        if failed {
          Text(
            "We couldn't save your answer. Try again.", tableName: "Today",
            comment: "Answering the suggested goal failed"
          )
          .foregroundStyle(.destructive)
        }
      }
      .disabled(answering != nil)
    }
    .navigationSubtitle(
      Text("Welcome back", tableName: "Today", comment: "Greets a learner back with no goal"))
  }

  /// Either answer closes the suggestion; accepting opens the start flow with its title in the box.
  private func answer(accepted: Bool) {
    answering = accepted
    failed = false

    Task {
      let result = await store.answer(suggestion, accepted: accepted)
      answering = nil

      switch result {
      case .done where accepted:
        router.open(.startGoal(goal: suggestion.title))
      case .failed:
        failed = true
      case .done, .obsolete:
        break
      }
    }
  }
}

/// A goal whose plan is being built after onboarding: Today waits and reads itself again. A goal
/// left halfway through its questions has no plan coming until they're answered, so Today says
/// what's missing and leads back to them instead.
private struct TodayPreparing: View {
  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(TodayStore.self) private var store

  let goalID: String
  let title: String

  var body: some View {
    let setup = onboarding.onboarding(goalID: goalID)
    let answersLeft = setup.value?.steps.contains { $0.rawValue != "plan" } == true

    Group {
      if answersLeft {
        ContentUnavailableView {
          Label {
            Text(
              "Your plan for \(title) needs a few more answers.", tableName: "Today",
              comment: "A goal left halfway through its questions")
          } icon: {
            Image(systemName: "list.bullet.clipboard")
          }
        } description: {
          Text(
            "It's built from what you tell us.", tableName: "Today",
            comment: "Why the goal's questions matter")
        } actions: {
          Button {
            router.open(.goalSetup(goalId: goalID))
          } label: {
            Text("Continue setting up", tableName: "Today", comment: "Opens the goal's questions")
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
        }
      } else {
        ContentUnavailableView {
          Label {
            Text("Building your plan", tableName: "Today", comment: "A plan is being built")
          } icon: {
            ProgressView()
          }
        } description: {
          Text(
            "Building your plan for \(title)", tableName: "Today",
            comment: "A plan is being built for the goal")
        }
        .task(id: goalID) {
          while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(5))
            await store.today.refresh()
          }
        }
      }
    }
    .loads(setup, refreshable: false)
  }
}

/// A paused or finished goal: nothing is planned for it today. A paused goal comes back with one
/// tap (saying first when resuming moves lessons the pause left behind); a new goal is the other
/// way on. A finished one offers a new goal.
private struct TodayGoalPaused: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @State private var isResuming = false
  @State private var failure: GoalStatusOutcome?
  @State private var resumeTask: Task<Void, Never>?

  private var goal: LearnerGoal? {
    let summary = learner.summary.value
    return summary?.goals.first { $0.id == summary?.activeGoalID }
  }

  var body: some View {
    if let goal, goal.status == .completed {
      ContentUnavailableView {
        Label {
          Text(
            "You finished \(goal.title).", tableName: "Today", comment: "Today for a finished goal")
        } icon: {
          Image(systemName: "flag.checkered")
        }
      } description: {
        Text(
          "Start a new goal, or pick another one above.", tableName: "Today",
          comment: "Today for a finished goal")
      } actions: {
        newGoal(prominent: true)
      }
    } else {
      paused
    }
  }

  private var paused: some View {
    ContentUnavailableView {
      Label {
        if let goal {
          Text("\(goal.title) is paused.", tableName: "Today", comment: "Today for a paused goal")
        } else {
          Text("This goal is paused.", tableName: "Today", comment: "Today for a paused goal")
        }
      } icon: {
        Image(systemName: "pause.circle")
      }
    } description: {
      VStack(spacing: 8) {
        Text(
          "Nothing is planned until you resume it.", tableName: "Today",
          comment: "Today for a paused goal")

        if let goal, plans.resumeChangesPlan(goalId: goal.id).value == true {
          Text(
            "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            tableName: "Today", comment: "What resuming the paused goal moves")
        }

        if failure == .limitReached {
          Text(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
            tableName: "Today", comment: "Why resuming the goal failed on the free plan"
          )
          .foregroundStyle(.destructive)
        } else if failure != nil {
          Text(
            "Couldn't save. Check your connection and try again.", tableName: "Today",
            comment: "Resuming the goal failed"
          )
          .foregroundStyle(.destructive)
        }
      }
    } actions: {
      if let goal {
        Button {
          resume(goal)
        } label: {
          Text("Resume \(goal.title)", tableName: "Today", comment: "Resumes the paused goal")
            .lineLimit(1)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .disabled(isResuming)
      }

      newGoal(prominent: goal == nil)
    }
    .modifier(ResumePreviewLoading(goalID: goal?.id))
    .onDisappear {
      resumeTask?.cancel()
    }
  }

  @ViewBuilder
  private func newGoal(prominent: Bool) -> some View {
    let button = Button {
      router.open(.startGoal())
    } label: {
      Text("New goal", tableName: "Today", comment: "Starts a new goal")
    }

    if prominent {
      button.buttonStyle(.mainAction).controlSize(.large)
    } else {
      button.buttonStyle(.bordered).controlSize(.large)
    }
  }

  /// Saved, the goal's resume invalidates the learner's goals, so Today reads its day again; the
  /// button stays busy until the day replaces this screen.
  private func resume(_ goal: LearnerGoal) {
    resumeTask?.cancel()
    resumeTask = Task {
      isResuming = true
      failure = nil

      switch await plans.setStatus(.active, goalId: goal.id) {
      case .done(.saved), .obsolete:
        break
      case .done(let refused):
        failure = refused
        isResuming = false
      case .failed:
        failure = .failed
        isResuming = false
      }
    }
  }
}

/// Reads what resuming would move, only for a paused goal.
private struct ResumePreviewLoading: ViewModifier {
  @Environment(PlanStore.self) private var plans

  let goalID: String?

  func body(content: Content) -> some View {
    if let goalID {
      content.loads(plans.resumeChangesPlan(goalId: goalID), refreshable: false)
    } else {
      content
    }
  }
}
