import SwiftUI

/// The bar over every tab root, as main's top bar: the goal switcher leading, the learner's belt
/// and level (opening Statistics) and the account trailing; a visitor gets "Log in" instead.
struct ShellToolbar: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isToolbarVertical) private var isToolbarVertical

  /// Search's root has its own field and no bar of the shell's.
  let isShown: Bool

  func body(content: Content) -> some View {
    if isShown {
      content.toolbar { items }
    } else {
      content
    }
  }

  /// Beside a vertical toolbar (the iPhone Duo) the bar holds the tab's title too. Folded, it's too
  /// narrow for the title and the goal's name both, and the system would drop the title, so the
  /// switcher shows only its symbol: the title keeps its place, as main's page title does, and the
  /// menu still names every goal.
  private var isSwitcherCompact: Bool {
    isToolbarVertical && horizontalSizeClass == .compact
  }

  @ToolbarContentBuilder
  private var items: some ToolbarContent {
    switch session.state {
    case .restoring:
      ToolbarItem(placement: .topBarTrailing) {
        EmptyView()
      }
    case .signedOut:
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          router.present(.signIn)
        } label: {
          Text("Log in", tableName: "Navigation", comment: "Opens sign-in")
        }
      }
    case .signedIn, .unavailable:
      if let summary = learner.summary.value {
        ToolbarItem(placement: .topBarLeading) {
          GoalSwitcher(summary: summary, isCompact: isSwitcherCompact)
        }

        if let level = summary.level {
          ToolbarItem(placement: .topBarTrailing) {
            LevelButton(level: level)
          }

          ToolbarSpacer(.fixed, placement: .topBarTrailing)
        }
      }

      ToolbarItem(placement: .topBarTrailing) {
        AccountToolbarButton {
          router.present(.account)
        }
      }
      .sharedBackgroundVisibility(.hidden)
    }
  }
}

/// The learner's belt as a dot and their level, opening Statistics: the one number of theirs
/// that only grows, in sight on every tab.
private struct LevelButton: View {
  @Environment(AppRouter.self) private var router

  let level: LearnerLevel
  @ScaledMetric(relativeTo: .body) private var dotSize: CGFloat = 9

  var body: some View {
    let belt = level.belt

    Button {
      router.open(.statistics)
    } label: {
      HStack(spacing: 6) {
        // The belt's own color, ringed so a white belt shows on a light bar.
        Circle()
          .fill(belt.color)
          .strokeBorder(.secondary.opacity(0.35), lineWidth: 1)
          .frame(width: dotSize, height: dotSize)

        Text(level.level, format: .number)
          .monospacedDigit()
      }
    }
    .accessibilityLabel(
      Text(
        "\(Text(belt.localizedTitle)), level \(level.level). Statistics", tableName: "Navigation",
        comment:
          "Spoken label of the toolbar button with the learner's belt and level, which opens their statistics"
      ))
  }
}

/// Main's goal switcher: the goal every tab shows, the other goals to switch to, open quick
/// explanations, and the ways to a new goal or the catalog. Acting on one goal (pause, archive)
/// lives on the Plan.
private struct GoalSwitcher: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @State private var pendingGoalId: String?
  /// Caps a long goal title so it truncates in the bar instead of moving to its overflow menu.
  @ScaledMetric(relativeTo: .body) private var maxTitleWidth: CGFloat = 140

  let summary: LearnerSummary
  /// Shows only the goal's symbol, for a bar without room for its name.
  let isCompact: Bool

  var body: some View {
    let followed = summary.followedGoals
    let explanations = summary.openExplanations

    if followed.isEmpty && explanations.isEmpty {
      Button {
        router.open(.startGoal())
      } label: {
        if isCompact {
          Image(systemName: "plus")
        } else {
          Label {
            startGoalTitle
          } icon: {
            Image(systemName: "plus")
          }
          .labelStyle(.titleAndIcon)
        }
      }
      .accessibilityLabel(startGoalTitle)
    } else {
      Menu {
        if !followed.isEmpty {
          Section {
            ForEach(followed, id: \.id) { goal in
              Toggle(isOn: isShown(goal)) {
                Text(goal.title)
                Text(goalLine(goal))
              }
            }
          } header: {
            Text(
              "Your goals", tableName: "Navigation",
              comment: "Heading over the learner's goals in the goal switcher")
          }
        }

        if !explanations.isEmpty {
          Section {
            ForEach(explanations, id: \.id) { goal in
              Button {
                router.open(.explain(goalId: goal.id))
              } label: {
                Label(goal.title, systemImage: "lightbulb")
              }
            }
          } header: {
            Text(
              "Quick explanations", tableName: "Navigation",
              comment: "Heading over the quick explanations the learner hasn't finished")
          }
        }

        Section {
          Button {
            router.open(.startGoal())
          } label: {
            Label {
              Text(
                "Start a new goal", tableName: "Navigation",
                comment: "Goal switcher option that starts another goal")
            } icon: {
              Image(systemName: "plus")
            }
          }

          Button {
            router.open(.catalog)
          } label: {
            Label {
              Text(
                "Explore courses", tableName: "Navigation",
                comment: "Goal switcher option that opens the course catalog")
            } icon: {
              Image(systemName: "square.grid.2x2")
            }
          }
        }
      } label: {
        if isCompact {
          Image(systemName: "target")
        } else {
          HStack(spacing: 4) {
            if let goal = shownGoal {
              Text(goal.title)
                .lineLimit(1)
                .frame(maxWidth: maxTitleWidth)
            } else {
              startGoalTitle
            }

            Image(systemName: "chevron.down")
              .imageScale(.small)
              .foregroundStyle(.secondary)
          }
          .fontWeight(.semibold)
        }
      }
      .accessibilityLabel(shownGoal.map { Text($0.title) } ?? startGoalTitle)
      .accessibilityHint(
        Text(
          "Current goal. Switch goal", tableName: "Navigation",
          comment: "Spoken hint of the goal switcher, after the current goal's title"))
    }
  }

  private var startGoalTitle: Text {
    Text(
      "Start a goal", tableName: "Navigation",
      comment: "Opens Today, where the learner starts a goal")
  }

  private var shownGoal: LearnerGoal? {
    summary.followedGoals.first { $0.id == pendingGoalId } ?? summary.shownGoal
  }

  /// Marks the goal the tabs show; choosing another shows it right away while the switch is
  /// saved, then follows the summary.
  private func isShown(_ goal: LearnerGoal) -> Binding<Bool> {
    Binding(
      get: { shownGoal?.id == goal.id },
      set: { isOn in
        guard isOn, shownGoal?.id != goal.id else {
          return
        }

        pendingGoalId = goal.id

        Task {
          await learner.switchGoal(to: goal.id)
          router.popToRoots()
          pendingGoalId = nil
        }
      })
  }
}

/// A goal's line in the switcher: its time a day and days left, or that it's paused or finished.
private func goalLine(_ goal: LearnerGoal) -> String {
  switch goal.status {
  case .paused:
    return String(
      localized: "Paused", table: "Navigation", comment: "A goal the learner paused")
  case .completed:
    return String(
      localized: "Finished", table: "Navigation", comment: "A goal the learner finished")
  case .active, .archived:
    let time = Duration.seconds(goal.dailyMinutes * 60)
      .formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))
    let perDay = String(
      localized: "\(time) a day", table: "Navigation",
      comment: "How long the learner studies a goal each day, such as 45 min a day")

    guard let days = daysLeft(until: goal.targetDate) else {
      return perDay
    }

    let left =
      days == 0
      ? String(
        localized: "The day is here", table: "Navigation",
        comment: "A goal whose target date is today")
      : String(
        localized: "\(days) days left", table: "Navigation",
        comment: "Days until a goal's target date")

    return "\(perDay) · \(left)"
  }
}

/// Days until a goal's date (YYYY-MM-DD, a calendar day), none once it passed.
private func daysLeft(until targetDate: String?) -> Int? {
  guard let targetDate,
    let date = try? Date(targetDate, strategy: .iso8601.year().month().day())
  else {
    return nil
  }

  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = .gmt
  let today = calendar.date(
    from: Calendar.current.dateComponents([.year, .month, .day], from: .now))
  guard let today,
    let days = calendar.dateComponents([.day], from: today, to: date).day, days >= 0
  else {
    return nil
  }

  return days
}

extension EnvironmentValues {
  /// Whether the system shows the toolbar as a vertical bar beside the content (iPhone Duo).
  var isToolbarVertical: Bool {
    if #available(iOS 27.1, *) {
      toolbarVerticalEdge != nil
    } else {
      false
    }
  }
}
