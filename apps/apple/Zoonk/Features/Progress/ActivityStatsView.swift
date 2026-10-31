import SwiftUI

/// Any learning day counts, a day of only reviews or practice too.
struct ActivityStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(
      state: progress.activity.state,
      hasNumbers: { $0.summary.learningDays > 0 },
      retry: { await progress.activity.refresh() }
    ) { activity in
      ActivityTiles(summary: activity.summary)
      ActivityCalendar(days: activity.days)
    }
    .loads(progress.activity)
  }
}

private struct ActivityTiles: View {
  let summary: ActivitySummary
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [3, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(
          "Study days", tableName: "Progress", comment: "Tile: how many days the learner studied"),
        value: Text(summary.learningDays, format: .number),
        systemImage: "calendar.badge.checkmark", tone: .success,
        detail: Text(
          "Any day you studied", tableName: "Progress",
          comment: "Under the study days: what counts as one")
      )

      StatTile(
        label: Text(
          "Lessons", tableName: "Progress", comment: "Tile: how many lessons the learner finished"),
        value: Text(summary.totalLessonCompletions, format: .number),
        systemImage: "book", tone: .success,
        detail: Text(
          "Finished", tableName: "Progress",
          comment: "Under the lessons count: lessons finished, agreeing with lessons")
      )

      StatTile(
        label: Text(
          "Time", tableName: "Progress", comment: "Tile: how long the learner has studied in total"),
        value: bigQuantity(progressLearningTime(summary.totalLearningSeconds)),
        systemImage: "clock",
        detail: Text(
          "Studying in total", tableName: "Progress", comment: "Under the learning time: all of it")
      )
    }
  }
}

struct ActivityCalendar: View {
  let days: [ActivityProgressDay]

  var body: some View {
    let maximum = days.map(\.activitiesCompleted).max() ?? 0
    let formatDay = calendarDayFormatter(newest: days.last?.date)
    let studied = days.count(where: { $0.activitiesCompleted > 0 })

    StatsCalendar(
      title: Text(
        "Past 12 months", tableName: "Progress",
        comment: "Title of a calendar of the past year's days"),
      gridLabel: Text(
        "Activity by day", tableName: "Progress", comment: "Spoken name of the study days calendar"),
      legendLabel: Text(
        "Activity from less to more", tableName: "Progress",
        comment: "Spoken key of the study days calendar's shades"),
      low: Text("Less", tableName: "Progress", comment: "Low end of the study days calendar's key"),
      high: Text(
        "More", tableName: "Progress", comment: "High end of the study days calendar's key"),
      shades: [
        Color(.systemFill), Color.success.opacity(0.25), Color.success.opacity(0.45),
        Color.success.opacity(0.7), Color.success,
      ],
      days: days.map { day in
        CalendarDay(
          date: day.date,
          step: CalendarSteps.activity(day.activitiesCompleted, maximum: maximum),
          label: "\(formatDay(day.date)) · \(activityCount(day.activitiesCompleted))",
          value: Double(day.activitiesCompleted))
      },
      chartTitle: String(
        localized: "Activity by day", table: "Progress",
        comment: "Spoken name of the study days calendar"),
      chartSummary: studied == 0
        ? String(
          localized: "No study in the past 12 months", table: "Progress",
          comment: "Summary of a study days calendar without a study day")
        : String(
          localized: "\(studied) study days in the past 12 months", table: "Progress",
          comment: "Summary of the study days calendar: how many days had study"))
  }

  private func activityCount(_ count: Int) -> String {
    count == 0
      ? String(localized: "No study", table: "Progress", comment: "A calendar day without study")
      : String(
        localized: "\(count) activities", table: "Progress",
        comment: "A calendar day's lessons, reviews and practice finished")
  }
}
