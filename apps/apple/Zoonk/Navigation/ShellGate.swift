import SwiftUI

enum LearnerAccess {
  case restoring
  case visitor
  /// Summary not read yet: screens load as for a learner with a goal.
  case signedIn
  case noGoal
  case learner

  @MainActor
  init(session: SessionStore, summary: LearnerSummary?) {
    switch session.state {
    case .restoring where session.authenticatedSession == nil:
      self = .restoring
    case .signedOut:
      self = .visitor
    // A restored token reads as signed in while launch validates it.
    case .restoring, .signedIn, .unavailable:
      guard let summary else {
        self = .signedIn
        return
      }

      self = summary.followedGoals.isEmpty ? .noGoal : .learner
    }
  }
}

/// The screen inside can assume what `requirement` asks for.
struct ShellGate<Content: View>: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session

  let requirement: AppRoute.Requirement
  let title: LocalizedStringResource
  var startsGoalHere = false
  @ViewBuilder let content: Content

  var body: some View {
    switch (requirement, LearnerAccess(session: session, summary: learner.summary.value)) {
    case (.none, _), (_, .signedIn), (_, .learner), (.account, .noGoal):
      content
    case (_, .restoring):
      Color.clear
        .navigationTitle(Text(title))
    case (_, .visitor):
      signInGate
        .navigationTitle(Text(title))
    case (.goal, .noGoal):
      Group {
        if startsGoalHere {
          goalBox
        } else {
          startGoalGate
        }
      }
      .navigationTitle(Text(title))
    }
  }

  private var signInGate: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Log in to continue", tableName: "Navigation",
          comment: "Title shown instead of a page that needs an account, to someone signed out")
      } icon: {
        Image(systemName: "lock")
      }
    } description: {
      Text(
        "Log in to pick up where you left off, or start free.", tableName: "Navigation",
        comment: "Explains the two ways on from a page that needs an account")
    } actions: {
      Button {
        router.present(.signIn)
      } label: {
        Text("Log in", tableName: "Navigation", comment: "Opens sign-in")
      }
      .buttonStyle(.glassProminent)

      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Start free", tableName: "Navigation",
          comment: "Opens Today, where someone without an account starts a goal")
      }
      .buttonStyle(.glass)
    }
  }

  private var startGoalGate: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Start with a goal", tableName: "Navigation",
          comment: "Title shown instead of a page that needs a goal, to a learner without one")
      } icon: {
        Image(systemName: "target")
      }
    } description: {
      Text(
        "Tell us what you want to learn, and we'll plan every day until you get there.",
        tableName: "Navigation",
        comment: "Explains what starting a goal does, on a page that needs one")
    } actions: {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Start a goal", tableName: "Navigation",
          comment: "Opens Today, where the learner starts a goal")
      }
      .buttonStyle(.glassProminent)
    }
  }

  private var goalBox: some View {
    List {
      Section {
        Text(
          "Tell us what you want to learn, and we'll plan every day until you get there.",
          tableName: "Navigation",
          comment: "Explains what starting a goal does, on a page that needs one"
        )
        .foregroundStyle(.secondary)
      }
      .listRowBackground(Color.clear)

      GoalStartEntry(isBoxOnly: true)
    }
  }
}
