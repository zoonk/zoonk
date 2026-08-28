import SwiftUI

struct ProgressOverviewView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(ProgressStore.self) private var progress
  @Environment(SessionStore.self) private var session

  let onSignIn: () -> Void

  var body: some View {
    Group {
      switch session.state {
      case .restoring:
        ProgressOverviewLoadingView()
      case .signedOut:
        signedOutView
      case .signedIn:
        signedInView
      case .unavailable:
        sessionUnavailableView
      }
    }
    .background(Color(.systemGroupedBackground))
    .navigationDestination(for: ProgressDestination.self) { destination in
      destinationView(destination)
        .navigationTitle(Text(destination.title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: horizontalSizeClass == .regular ? .title : nil)
    }
    .refreshesProgress {
      await progress.loadOverview()
    }
  }

  @ViewBuilder
  private var signedInView: some View {
    switch progress.overviewState {
    case .idle, .loading:
      ProgressOverviewLoadingView()
    case .loaded(let overview):
      ProgressOverviewContent(overview: overview)
    case .empty:
      ProgressUnavailableView(
        title: Text(
          "Your progress starts here",
          tableName: "Progress",
          comment: "Title shown when a signed-in learner has no progress yet."),
        description: Text(
          "Complete a lesson to start tracking your activity, Score, level, and Energy.",
          tableName: "Progress",
          comment: "Guidance shown when a signed-in learner has no progress yet."),
        systemImage: "chart.line.uptrend.xyaxis")
    case .failed(let failure):
      progressFailureView(failure)
    }
  }

  private var signedOutView: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Sign in to see your progress",
          tableName: "Progress",
          comment: "Title shown when progress requires the learner to sign in.")
      } icon: {
        Image(systemName: "chart.line.uptrend.xyaxis")
      }
    } description: {
      Text(
        "Your activity, Score, patterns, level, and Energy stay connected to your account.",
        tableName: "Progress",
        comment: "Explains why signing in is required to view progress.")
    } actions: {
      Button(action: onSignIn) {
        Text(
          "Sign in",
          tableName: "Progress",
          comment: "Action that opens account sign-in from the Progress tab.")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private var sessionUnavailableView: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Account unavailable",
          tableName: "Progress",
          comment: "Title shown when the saved account could not be restored.")
      } icon: {
        Image(systemName: "person.crop.circle.badge.exclamationmark")
      }
    } description: {
      Text(
        "Check your connection, then try again.",
        tableName: "Progress",
        comment: "Recovery guidance when the saved account could not be restored.")
    } actions: {
      Button {
        Task {
          await session.retryRestore()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Progress",
          comment: "Retries restoring the account from the Progress tab.")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private func progressFailureView(_ failure: ProgressFailure) -> some View {
    ProgressUnavailableView(
      title: progressFailureTitle(failure),
      description: Text(
        "Your progress is safe. Try loading it again.",
        tableName: "Progress",
        comment: "Recovery guidance when progress cannot be loaded."),
      systemImage: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle",
      retry: {
        await progress.loadOverview(force: true)
      })
  }

  private func progressFailureTitle(_ failure: ProgressFailure) -> Text {
    switch failure {
    case .network:
      Text(
        "You're offline",
        tableName: "Progress",
        comment: "Title shown when progress cannot load because the network is unavailable.")
    case .unavailable:
      Text(
        "Progress is unavailable",
        tableName: "Progress",
        comment: "Title shown when the progress service cannot provide data.")
    }
  }

  @ViewBuilder
  private func destinationView(_ destination: ProgressDestination) -> some View {
    switch destination {
    case .activity:
      ActivityProgressView()
    case .score:
      ScoreProgressView()
    case .patterns:
      ScorePatternsView()
    case .level:
      LevelProgressView()
    case .energy:
      EnergyProgressView()
    }
  }
}

private struct ProgressOverviewContent: View {
  let overview: ProgressOverview

  private let columns = [
    GridItem(.adaptive(minimum: 280, maximum: 420), spacing: 16, alignment: .top)
  ]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "At a glance",
            tableName: "Progress",
            comment: "Heading above the learner's progress summary cards."
          )
          .font(.title2.bold())

          Text(
            "See what you've accomplished and where you're building momentum.",
            tableName: "Progress",
            comment: "Description above the learner's progress summary cards."
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }

        LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
          activityCard
          scoreCard
          patternsCard
          levelCard
          energyCard
        }
      }
      .frame(maxWidth: 1_040, alignment: .leading)
      .padding(.horizontal)
      .padding(.vertical, 20)
      .frame(maxWidth: .infinity)
    }
  }

  private var activityCard: some View {
    ProgressOverviewCard(destination: .activity) {
      ProgressOverviewMetric(
        value: overview.activity.totalLessonCompletions.formatted(),
        label: Text(
          "Lessons completed",
          tableName: "Progress",
          comment: "Label for the learner's lifetime completed lesson count."))

      ProgressOverviewSupportingMetrics {
        ProgressOverviewSupportingMetric(
          value: overview.activity.learningDays.formatted(),
          label: Text(
            "Learning days",
            tableName: "Progress",
            comment: "Label for the learner's lifetime count of days with learning activity."))
        ProgressOverviewSupportingMetric(
          value: overviewLearningTime(overview.activity.totalLearningSeconds),
          label: Text(
            "Learning time",
            tableName: "Progress",
            comment: "Label for the learner's lifetime lesson time."))
      }
    }
  }

  private var scoreCard: some View {
    ProgressOverviewCard(destination: .score) {
      if let score = overview.score {
        ProgressOverviewMetric(
          value: overviewPercent(score.score),
          label: Text(
            "Answer accuracy",
            tableName: "Progress",
            comment: "Label for the learner's Score accuracy over the last 90 days."))

        ProgressOverviewSupportingMetric(
          value: score.totalAnswers.formatted(),
          label: Text(
            "Answers in the last 90 days",
            tableName: "Progress",
            comment: "Label for the answer count used to calculate Score."))
      } else {
        ProgressOverviewMissingMetric(
          description: Text(
            "Answer questions to see your Score.",
            tableName: "Progress",
            comment: "Guidance when the learner does not have a Score yet."))
      }
    }
  }

  private var patternsCard: some View {
    ProgressOverviewCard(destination: .patterns) {
      if let weekday = overview.strongestWeekday {
        ProgressOverviewMetric(
          value: weekday.weekday.localizedTitle,
          label: Text(
            "Best day",
            tableName: "Progress",
            comment: "Label for the weekday when the learner has their strongest Score."))

        ProgressOverviewSupportingMetrics {
          ProgressOverviewSupportingMetric(
            value: overview.strongestDaypart.map { String(localized: $0.daypart.localizedTitle) }
              ?? "—",
            label: Text(
              "Best time",
              tableName: "Progress",
              comment: "Label for the daypart when the learner has their strongest Score."))
          ProgressOverviewSupportingMetric(
            value: weekday.performance.totalAnswers.formatted(),
            label: Text(
              "Answers on that day",
              tableName: "Progress",
              comment: "Label for the sample size behind the learner's strongest weekday."))
        }
      } else if let daypart = overview.strongestDaypart {
        ProgressOverviewMetric(
          value: String(localized: daypart.daypart.localizedTitle),
          label: Text(
            "Best time",
            tableName: "Progress",
            comment: "Label for the daypart when the learner has their strongest Score."))

        ProgressOverviewSupportingMetric(
          value: daypart.performance.totalAnswers.formatted(),
          label: Text(
            "Answers in the last 90 days",
            tableName: "Progress",
            comment: "Label for the answer count used to calculate Score."))
      } else {
        ProgressOverviewMissingMetric(
          description: Text(
            "Keep answering to discover your strongest learning patterns.",
            tableName: "Progress",
            comment: "Guidance when the learner does not have Score patterns yet."))
      }
    }
  }

  private var levelCard: some View {
    ProgressOverviewCard(
      destination: .level,
      tint: overview.level?.belt.progressColor ?? ProgressDestination.level.tint
    ) {
      if let level = overview.level {
        ProgressOverviewMetric(
          value: String(localized: level.belt.localizedTitle),
          label: Text(
            "Level \(level.level)",
            tableName: "Progress",
            comment: "Learner's level number within their current belt."))

        ProgressView(
          value: level.progressValue,
          total: level.progressTotal
        )
        .tint(level.belt.progressColor)
        .accessibilityLabel(
          level.isMaxLevel
            ? Text(
              "Level progress",
              tableName: "Progress",
              comment: "Accessibility label for progress within the maximum level.")
            : Text(
              "Progress to the next level",
              tableName: "Progress",
              comment: "Accessibility label for progress toward the learner's next level.")
        )
        .accessibilityValue(
          level.isMaxLevel
            ? Text(
              "Complete",
              tableName: "Progress",
              comment: "Value shown when the learner has reached the maximum level")
            : Text(
              "\(level.progressInLevel) of \(level.bpPerLevel) BP",
              tableName: "Progress",
              comment: "Accessibility value describing Brain Power earned toward the next level."))
      } else {
        ProgressOverviewMissingMetric(
          description: Text(
            "Complete a lesson to begin earning Brain Power.",
            tableName: "Progress",
            comment: "Guidance when the learner has not unlocked a level yet."))
      }
    }
  }

  private var energyCard: some View {
    ProgressOverviewCard(destination: .energy) {
      if let energy = overview.energy {
        ProgressOverviewMetric(
          value: overviewPercent(energy),
          label: Text(
            "Current Energy",
            tableName: "Progress",
            comment: "Label for the learner's current Energy value."))

        ProgressView(value: energy, total: 100)
          .tint(ProgressDestination.energy.tint)
          .accessibilityLabel(
            Text(
              "Current Energy",
              tableName: "Progress",
              comment: "Accessibility label for the learner's current Energy.")
          )
          .accessibilityValue(overviewPercent(energy))
      } else {
        ProgressOverviewMissingMetric(
          description: Text(
            "Complete a lesson to start building Energy.",
            tableName: "Progress",
            comment: "Guidance when the learner does not have an Energy value yet."))
      }
    }
  }
}

private struct ProgressOverviewCard<Content: View>: View {
  let destination: ProgressDestination
  let tint: Color
  @ViewBuilder let content: Content

  init(
    destination: ProgressDestination,
    tint: Color? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.destination = destination
    self.tint = tint ?? destination.tint
    self.content = content()
  }

  var body: some View {
    NavigationLink(value: destination) {
      VStack(alignment: .leading, spacing: 16) {
        HStack(spacing: 12) {
          Image(systemName: destination.systemImage)
            .font(.headline)
            .foregroundStyle(tint)
            .frame(width: 34, height: 34)
            .background(tint.opacity(0.12), in: Circle())

          Text(destination.title)
            .font(.headline)

          Spacer(minLength: 8)

          Image(systemName: "chevron.forward")
            .font(.caption.bold())
            .foregroundStyle(.tertiary)
            .accessibilityHidden(true)
        }

        content
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(20)
      .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityHint(
      Text(
        "View details",
        tableName: "Progress",
        comment: "Accessibility hint for opening a progress metric's detail screen."))
  }
}

private struct ProgressOverviewMetric: View {
  let value: String
  let label: Text

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value)
        .font(.title.bold())
        .foregroundStyle(.primary)
        .monospacedDigit()
      label
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }
}

private struct ProgressOverviewSupportingMetrics<Content: View>: View {
  @ViewBuilder let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .top, spacing: 24) {
        content
      }

      VStack(alignment: .leading, spacing: 12) {
        content
      }
    }
  }
}

private struct ProgressOverviewSupportingMetric: View {
  let value: String
  let label: Text

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value)
        .font(.headline)
        .monospacedDigit()
      label
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct ProgressOverviewMissingMetric: View {
  let description: Text

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("—")
        .font(.title.bold())
      description
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }
}

private struct ProgressOverviewLoadingView: View {
  private let columns = [
    GridItem(.adaptive(minimum: 280, maximum: 420), spacing: 16, alignment: .top)
  ]

  var body: some View {
    ScrollView {
      LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
        ForEach(ProgressDestination.allCases) { destination in
          VStack(alignment: .leading, spacing: 16) {
            Label {
              Text(destination.title)
            } icon: {
              Image(systemName: destination.systemImage)
            }
            .font(.headline)

            Text("88%")
              .font(.title.bold())
            Text("Progress summary")
              .font(.subheadline)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(20)
          .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
          .redacted(reason: .placeholder)
          .accessibilityHidden(true)
        }
      }
      .frame(maxWidth: 1_040, alignment: .leading)
      .padding(.horizontal)
      .padding(.vertical, 20)
      .frame(maxWidth: .infinity)
    }
    .accessibilityLabel(
      Text(
        "Loading progress",
        tableName: "Progress",
        comment: "Accessibility status while the progress overview loads."))
  }
}

struct ProgressUnavailableView: View {
  let title: Text
  let description: Text
  let systemImage: String
  var retry: (() async -> Void)?

  var body: some View {
    ContentUnavailableView {
      Label {
        title
      } icon: {
        Image(systemName: systemImage)
      }
    } description: {
      description
    } actions: {
      if let retry {
        Button {
          Task {
            await retry()
          }
        } label: {
          Text(
            "Try again",
            tableName: "Progress",
            comment: "Retries loading a progress screen.")
        }
        .buttonStyle(.borderedProminent)
      }
    }
  }
}

private func overviewPercent(_ value: Double) -> String {
  (value / 100).formatted(.percent.precision(.fractionLength(0)))
}

private func overviewLearningTime(_ totalSeconds: Int) -> String {
  progressLearningTime(totalSeconds)
}

#Preview("Signed out") {
  let session = SessionStore.preview()
  let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)

  NavigationStack {
    ProgressOverviewView(onSignIn: {})
      .navigationTitle(
        Text(
          "Progress",
          tableName: "Navigation",
          comment: "Navigation title for the learner's progress overview."))
  }
  .environment(ProgressStore(api: ProgressAPI(clients: clients), session: session))
  .environment(session)
}
