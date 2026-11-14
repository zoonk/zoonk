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
          "Days studied", tableName: "Progress",
          comment:
            "Tile: how many days the learner studied"),
        value: Text(summary.learningDays, format: .number),
        systemImage: "calendar.badge.checkmark", tone: .success)

      StatTile(
        label: Text(
          "Lessons", tableName: "Progress", comment: "Tile: how many lessons the learner finished"),
        value: Text(summary.totalLessonCompletions, format: .number),
        systemImage: "book", tone: .success)

      StatTile(
        label: Text(
          "Time", tableName: "Progress",
          comment:
            "Tile: how long the learner has studied in total"),
        quantity: progressLearningTime(summary.totalLearningSeconds),
        systemImage: "clock")
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
        "Past 12 months", tableName: "Progress"),
      gridLabel: Text(
        "Activity by day", tableName: "Progress"),
      legendLabel: Text(
        "Activity from less to more", tableName: "Progress",
        comment:
          "Legend of a heatmap, from the lightest to the darkest squares."),
      low: Text(
        "Less", tableName: "Progress",
        comment:
          "The light end of a heatmap's legend: less activity."),
      high: Text(
        "More", tableName: "Progress",
        comment:
          "The dark end of a heatmap's legend: more activity."),
      shades: [
        Color.surface3, Color.success.opacity(0.25), Color.success.opacity(0.45),
        Color.success.opacity(0.7), Color.success,
      ],
      days: days.map { day in
        CalendarDay(
          date: day.date,
          step: CalendarSteps.activity(day.activitiesCompleted, maximum: maximum),
          detail: ChartPointDetail(
            label: formatDay(day.date), value: activityCount(day.activitiesCompleted)),
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
      : String(localized: "Studied", table: "Progress", comment: "A calendar day with study")
  }
}
