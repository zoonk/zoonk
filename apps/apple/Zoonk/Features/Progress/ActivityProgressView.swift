import SwiftUI

struct ActivityProgressView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    ProgressDetailLoadStateView(
      state: progress.activityState,
      emptyTitle: LocalizedStringResource(
        "No activity yet",
        table: "Progress",
        comment: "Title shown before the learner completes a lesson"),
      emptyDescription: LocalizedStringResource(
        "Complete a lesson to start building your learning history.",
        table: "Progress",
        comment: "Guidance shown before the learner has activity progress"),
      systemImage: "chart.bar.xaxis",
      retry: { await progress.loadActivity(force: true) }
    ) { activity in
      ActivityProgressContent(activity: activity)
    }
    .refreshesProgress {
      await progress.loadActivity()
    }
  }
}

private struct ActivityProgressContent: View {
  let activity: ActivityProgress

  private var contributions: [ProgressContributionPoint] {
    ProgressChartData.activityContributions(from: activity.days)
  }

  private var contributionWeeks: [ProgressContributionWeek] {
    ProgressChartData.contributionWeeks(from: contributions)
  }

  var body: some View {
    ProgressDetailPage {
      ProgressDetailHero(
        title: Text(
          "Lessons completed",
          tableName: "Progress",
          comment: "Label above the learner's lifetime completed lesson count"),
        value: Text(activity.summary.totalLessonCompletions, format: .number),
        description: Text(
          "Your lifetime learning activity.",
          tableName: "Progress",
          comment: "Description below the lifetime activity total"),
        systemImage: "checkmark.circle.fill",
        tint: ProgressDestination.activity.tint)

      ProgressDetailSection(
        title: Text(
          "Learning activity",
          tableName: "Progress",
          comment: "Title above the completed lesson contribution calendar"),
        subtitle: Text(
          "Past 12 months.",
          tableName: "Progress",
          comment: "Period shown above the completed lesson contribution calendar")
      ) {
        if contributionWeeks.isEmpty {
          ProgressDetailNoChartData()
        } else {
          ProgressContributionCalendar(
            weeks: contributionWeeks,
            maximumIntensity: ProgressChartData.activityMaximumIntensity,
            tint: ProgressDestination.activity.tint,
            lowLabel: Text(
              "Less",
              tableName: "Progress",
              comment: "Low end of the learning activity contribution legend"),
            highLabel: Text(
              "More",
              tableName: "Progress",
              comment: "High end of the learning activity contribution legend"),
            accessibilityLabel: Text(
              "Learning activity over the past 12 months",
              tableName: "Progress",
              comment: "Accessibility label for the completed lesson contribution calendar"),
            accessibilityValue: { point in
              Text(
                "Lessons completed: \(Int(point.value ?? 0))",
                tableName: "Progress",
                comment: "Accessible daily completed lesson value in the activity calendar")
            })
        }
      }

      ProgressDetailMetricGrid {
        ProgressDetailMetric(
          label: Text(
            "Learning days",
            tableName: "Progress",
            comment: "Label for the number of days on which the learner studied"),
          value: Text(activity.summary.learningDays, format: .number),
          systemImage: "calendar",
          tint: ProgressDestination.activity.tint)

        ProgressDetailMetric(
          label: Text(
            "Time learning",
            tableName: "Progress",
            comment: "Label for the learner's total study duration"),
          value: Text(
            verbatim: progressLearningTime(activity.summary.totalLearningSeconds)),
          systemImage: "clock",
          tint: ProgressDestination.activity.tint)
      }

      ProgressDetailExplanation(
        title: Text(
          "A lasting record",
          tableName: "Progress",
          comment: "Title explaining how completed lessons are counted"),
        description: Text(
          "Each completed lesson counts once, even when you return to review it.",
          tableName: "Progress",
          comment: "Explains that activity counts unique completed lessons"),
        systemImage: "book.closed",
        tint: ProgressDestination.activity.tint)
    }
  }
}
