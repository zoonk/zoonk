import SwiftUI

enum LearnerAccess {
  case restoring
  case visitor
  case sessionEnded
  /// Summary not read yet: screens load as for a learner with a goal.
  case signedIn
  case noGoal
  case learner

  @MainActor
  init(session: SessionStore, summary: LearnerSummary?) {
    switch session.state {
    case .restoring where session.authenticatedSession == nil:
      self = .restoring
    case .signedOut(let sessionEnded):
      self = sessionEnded ? .sessionEnded : .visitor
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
  @State private var goal = SentGoal(words: "")

  let requirement: AppRoute.Requirement
  let title: LocalizedStringResource
  var description: LocalizedStringResource?
  var startsGoalHere = false
  @ViewBuilder let content: Content

  var body: some View {
    let access = LearnerAccess(session: session, summary: learner.summary.value)

    switch (requirement, access) {
    case (.none, _), (_, .signedIn), (_, .learner), (.account, .noGoal):
      content
    case (_, .restoring):
      Color.clear
        .navigationTitle(Text(title))
    case (_, .visitor), (_, .sessionEnded):
      SignInGate(sessionEnded: access == .sessionEnded)
        .described(by: description)
        .lonePage()
        .navigationTitle(Text(title))
    case (.goal, .noGoal) where startsGoalHere:
      goalBox
        .navigationTitle(Text(title))
    case (.goal, .noGoal):
      startGoalGate
        .described(by: description)
        .lonePage()
        .navigationTitle(Text(title))
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
      .buttonStyle(.mainAction)
    }
  }

  /// An open book faces the box with the goal's examples, as Today's first goal does; the box keeps
  /// what's typed in it as they come and go.
  private var goalBox: some View {
    PaneBeside(atHingeOnly: true, paneEdge: .trailing, primaryShare: 0.55) {
      List {
        GoalStartEntry(part: .examples, goal: $goal)
      }
    } content: { _ in
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

        GoalStartEntry(part: .box, goal: $goal)
      }
    }
  }
}

/// Main's `AuthGate`.
struct SignInGate: View {
  @Environment(AppRouter.self) private var router

  let sessionEnded: Bool

  var body: some View {
    ContentUnavailableView {
      Label {
        sessionEnded
          ? Text(
            "Your session ended", tableName: "Navigation",
            comment:
              "Title shown instead of a page that needs an account, to someone whose session ended")
          : Text(
            "Log in to continue", tableName: "Navigation",
            comment: "Title shown instead of a page that needs an account, to someone signed out")
      } icon: {
        Image(systemName: "lock")
      }
    } description: {
      sessionEnded
        ? Text(
          "Log in to pick up your plan.", tableName: "Navigation",
          comment: "Tells someone whose session ended that their plan is still in their account")
        : Text(
          "Log in to pick up where you left off, or start free.", tableName: "Navigation",
          comment: "Explains the two ways on from a page that needs an account")
    } actions: {
      Button {
        router.present(.signIn)
      } label: {
        Text("Log in", tableName: "Navigation", comment: "Opens sign-in")
      }
      .buttonStyle(.mainAction)

      if sessionEnded {
        Button {
          router.open(.startGoal())
        } label: {
          Text(
            "Start something new", tableName: "Navigation",
            comment: "Opens the start of a new goal, for someone whose session ended")
        }
        .buttonStyle(.glass)
      } else {
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
  }
}

extension View {
  /// A navigation subtitle is cut to one line on a phone; the page's first line wraps.
  @ViewBuilder
  func described(by description: LocalizedStringResource?) -> some View {
    if let description {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          Text(description)
            .foregroundStyle(.secondary)

          self
        }
        .scenePadding(.horizontal)
      }
    } else {
      self
    }
  }
}
