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

/// A visitor or a learner without a goal: Today is where a goal starts.
private struct TodayStartGoal: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    // TODO(S5): embed the start form view from ONBOARDING-CONTRACT.md once it lands; until then
    // Today leads to the start flow's screen.
    ContentUnavailableView {
      Label {
        Text("Start a goal", tableName: "Today", comment: "Title of Today without a goal")
      } icon: {
        Image(systemName: "target")
      }
    } description: {
      Text(
        "Each day's lessons, reviews and practice for your goal.", tableName: "Today",
        comment: "What Today holds once there's a goal")
    } actions: {
      Button {
        router.open(.startGoal())
      } label: {
        Text("Start a goal", tableName: "Today", comment: "Opens the start of a new goal")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
  }
}

/// A learner back from before goals existed: their last course is offered first.
private struct TodaySuggestedGoal: View {
  @Environment(AppRouter.self) private var router
  @Environment(TodayStore.self) private var store

  let suggestion: SuggestedGoal

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Continue \(suggestion.title)?", tableName: "Today",
          comment: "Offers a goal from the learner's last course")
      } icon: {
        Image(systemName: "safari")
      }
    } description: {
      Text("Build a plan in 1 minute.", tableName: "Today", comment: "Suggested goal's promise")
    } actions: {
      Button {
        router.open(.startGoal())
      } label: {
        Text("Build my plan", tableName: "Today", comment: "Accepts the suggested goal")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
    .navigationSubtitle(
      Text("Welcome back", tableName: "Today", comment: "Greets a learner back with no goal"))
  }
}

/// A goal whose plan is being built after onboarding: Today waits and reads itself again.
private struct TodayPreparing: View {
  @Environment(TodayStore.self) private var store

  let goalID: String
  let title: String

  var body: some View {
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

/// A paused, finished or archived goal: nothing is planned until the learner resumes it or picks
/// another, which the Plan and the goal switcher do.
private struct TodayGoalPaused: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    ContentUnavailableView {
      Label {
        Text("This goal is paused.", tableName: "Today", comment: "Today for a paused goal")
      } icon: {
        Image(systemName: "pause.circle")
      }
    } description: {
      Text(
        "Nothing is planned until you resume it.", tableName: "Today",
        comment: "Today for a paused goal")
    } actions: {
      Button {
        router.select(.plan)
      } label: {
        Text("Go to your Plan", tableName: "Today", comment: "Opens the Plan to resume a goal")
      }
      .buttonStyle(.bordered)
    }
  }
}
