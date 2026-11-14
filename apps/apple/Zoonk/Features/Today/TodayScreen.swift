import SwiftUI

/// One job: start or continue today's session.
struct TodayScreen: View {
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(SessionStore.self) private var session
  @Environment(TodayStore.self) private var store

  var body: some View {
    content
      .navigationTitle(Text("Today", tableName: "Today", comment: "Today tab's title"))
  }

  @ViewBuilder
  private var content: some View {
    if session.state == .signedOut(sessionEnded: true) {
      // The plan is still in the account, so this leads back to it instead of a first goal built
      // again as a guest.
      SignInGate(sessionEnded: true)
        .described(
          by: LocalizedStringResource(
            "Each day's lessons, reviews and practice for your goal.", table: "Today",
            comment: "What Today is for, above the way to log back in after a session ended")
        )
        .lonePage()
    } else if session.authenticatedSession == nil {
      // Signed out, Today is the app's front door, as main's home page is the web's.
      TodayStartGoal()
        .onAppear {
          UsageAnalytics.track(.homeViewed)
        }
    } else {
      signedIn
        .loads(store.today, onboarding.resume)
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
          .lonePage()
      } else {
        TodayStartGoal()
      }
    case .loaded(.preparing(let goalID, let displayName)):
      TodayPreparing(goalID: goalID, displayName: displayName)
        .lonePage()
    case .loaded(.goalNotActive):
      VStack(spacing: 0) {
        UnfinishedGoalPanel()
        TodayGoalPaused()
      }
      .lonePage()
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
        .buttonStyle(.outline)
      }
      .lonePage()
    default:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .lonePage()
    }
  }
}

/// A goal typed and not confirmed yet, on the web or here, comes back where it was left.
private struct TodayStartGoal: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding
  @State private var goal = SentGoal(words: "")

  var body: some View {
    // The box keeps what's typed or pasted in it, and an open editor, as the examples come and go.
    PaneBeside(paneEdge: .trailing, primaryShare: 0.55) {
      ZoonkList {
        GoalStartEntry(part: .examples, goal: $goal)
      }
    } content: { isBeside in
      ZoonkList {
        resume
        GoalStartEntry(part: isBeside ? .form : .whole, goal: $goal)
      }
    }
    .loads(onboarding.resume, refreshable: false)
  }

  @ViewBuilder
  private var resume: some View {
    if let explanation = learner.summary.value?.openExplanations.last {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Text(explanation.displayName)
            Text("Quick explanation", tableName: "Today", comment: "An unfinished explanation")
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        } icon: {
          Image(systemName: "play")
            .foregroundStyle(.mutedForeground)
        }

        Button {
          router.open(.explain(goalId: explanation.id))
        } label: {
          Text(
            "Continue", tableName: "Today",
            comment: "Opens the learner's unfinished quick explanation")
        }
      }
    }

    UnfinishedGoalSection()
  }
}

/// A goal card typed after the learner's newest goal and not confirmed yet, offered back where it
/// was left, so a learner who paused a goal to make room for it doesn't type it again.
struct UnfinishedGoalSection: View {
  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    if let draft = onboarding.resume.value?.draft {
      Section {
        VStack(alignment: .leading, spacing: 2) {
          Text(draft.prompt)
          UnfinishedGoalLine()
        }
        ContinueDraftButton(draft: draft)
      }
    }
  }
}

/// The same offer outside a list, leading a screen that has no day to show.
private struct UnfinishedGoalPanel: View {
  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    if let draft = onboarding.resume.value?.draft {
      GroupBox {
        VStack(alignment: .leading, spacing: 2) {
          Text(draft.prompt)
            .lineLimit(3)
          UnfinishedGoalLine()
        }

        ContinueDraftButton(draft: draft)
          .buttonStyle(.outline)
          .controlSize(.small)
      }
      .groupBoxStyle(.panel)
      .padding(.horizontal, 16)
      .padding(.top, 8)
    }
  }
}

private struct UnfinishedGoalLine: View {
  var body: some View {
    Text(
      "You didn't finish setting this up.", tableName: "Today",
      comment: "Under a goal the learner typed and didn't confirm"
    )
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
  }
}

private struct ContinueDraftButton: View {
  @Environment(AppRouter.self) private var router

  let draft: OnboardingResume.Draft

  var body: some View {
    Button {
      router.open(.startGoal(draftId: draft.draftId))
    } label: {
      Text(
        "Continue", tableName: "Today",
        comment: "Opens the goal the learner typed and hasn't confirmed yet")
    }
  }
}

private struct TodaySuggestedGoal: View {
  let suggestion: SuggestedGoal

  var body: some View {
    ZoonkList {
      SuggestedGoalSection(suggestion: suggestion)
    }
    .navigationSubtitle(
      Text("Welcome back", tableName: "Today", comment: "Greets a learner back with no goal"))
  }
}

/// A goal left halfway through its questions has no plan coming until they're answered, so Today
/// says what's missing and leads back to them.
private struct TodayPreparing: View {
  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  @Environment(TodayStore.self) private var store
  @State private var attempt = 0
  @State private var stoppedFollowing = false

  let goalID: String
  let displayName: String

  var body: some View {
    let setup = onboarding.onboarding(goalID: goalID)
    let answersLeft = setup.value?.steps.hasSetupQuestions == true
    // A made plan is shown once before its first day, so Today leads there instead of opening it.
    let revealLeft = setup.value.map { $0.planReadiness.ready && !$0.planRevealed } == true

    Group {
      if !answersLeft, revealLeft {
        ContentUnavailableView {
          Label {
            Text(
              "Your \(displayName) plan is ready.", tableName: "Today",
              comment: "A goal whose plan the learner hasn't looked at yet")
          } icon: {
            Image(systemName: "map")
          }
        } actions: {
          Button {
            router.open(.goalSetup(goalId: goalID))
          } label: {
            Text(
              "See your plan", tableName: "Today",
              comment: "Opens the goal's plan before its first day")
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
        }
      } else if answersLeft {
        ContentUnavailableView {
          Label {
            Text(
              "Your \(displayName) plan needs a few more answers.", tableName: "Today",
              comment: "A goal left halfway through its questions")
          } icon: {
            Image(systemName: "list.bullet.clipboard")
          }
        } actions: {
          Button {
            router.open(.goalSetup(goalId: goalID))
          } label: {
            Text("Continue", tableName: "Today", comment: "Opens the goal's questions")
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
        }
      } else {
        ContentUnavailableView {
          Label {
            Text(
              "Building your \(displayName) plan", tableName: "Today",
              comment: "A plan is being built for the goal")
          } icon: {
            ProgressView()
          }
        } description: {
          Text(
            "It takes a minute or two. Your first day opens here as soon as it's ready.",
            tableName: "Today", comment: "While a goal's plan is being built")
        } actions: {
          if stoppedFollowing {
            Button {
              stoppedFollowing = false
              attempt += 1
            } label: {
              Text("Try again", tableName: "Today", comment: "Retries loading Today")
            }
            .buttonStyle(.outline)
          }
        }
        .task(id: "\(goalID):\(attempt)") {
          await waitForPlan()

          // Still here: the build's events ended without the day showing.
          if !Task.isCancelled {
            stoppedFollowing = true
          }
        }
      }
    }
    .loads(setup, refreshable: false)
  }

  /// Follows the plan's build. Once the plan is saved, each further step of the build reads Today
  /// and the goal's setup again until the first day or the plan's reveal shows, which leaves this
  /// state and ends the task.
  private func waitForPlan() async {
    guard let token = plans.cache.session.authenticatedSession?.bearerToken else {
      return
    }

    if let id = try? await plans.api.goalGenerationId(token: token, goalId: goalID) {
      var run = PlanBuildingRun()

      do {
        for try await event in plans.api.generationEvents(id: id, token: token) {
          run.record(event)

          if run.isPlanSaved {
            await refresh()
          }
        }
      } catch {}
    }

    guard !Task.isCancelled else {
      return
    }

    await refresh()
  }

  private func refresh() async {
    async let today: Void = store.today.refresh()
    async let setup: Void = onboarding.onboarding(goalID: goalID).refresh()
    _ = await (today, setup)
  }
}

/// Resuming a paused goal says first when it moves lessons the pause left behind.
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
            "You finished your \(goal.displayName) goal.", tableName: "Today",
            comment: "Today for a finished goal")
        } icon: {
          Image(systemName: "flag.checkered")
        }
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
          Text(
            "Your \(goal.displayName) goal is paused.", tableName: "Today",
            comment: "Today for a paused goal"
          )
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
          FailureLine(
            message: GoalError.resumeLimit)
        } else if failure != nil {
          FailureLine(
            message: LocalizedStringResource(
              "Couldn't save. Check your connection and try again.", table: "Today",
              comment: "Resuming the goal failed"))
        }
      }
    } actions: {
      if let goal {
        Button {
          resume(goal)
        } label: {
          Text("Resume", tableName: "Today", comment: "Resumes the paused goal")
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
      button.buttonStyle(.outline).controlSize(.large)
    }
  }

  /// The button stays busy until the day replaces this screen.
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
