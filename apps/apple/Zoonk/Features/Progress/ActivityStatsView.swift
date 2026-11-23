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
    let maximumSeconds = days.map(\.timeSpentSeconds).max() ?? 0
    let today = PlanDate.today()

    StatsCalendar(
      gridLabel: Text(
        "Activity by day", tableName: "Progress"),
      legendTitle: Text(
        "Study time", tableName: "Progress",
        comment:
          "Names the legend of a calendar of study days: a darker square means more minutes studied that day."
      ),
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
      days: days.map { $0.calendarDay(maximumSeconds: maximumSeconds, today: today) },
      chartTitle: String(
        localized: "Activity by day", table: "Progress",
        comment: "Spoken name of the study days calendar"),
      valueText: { progressLearningTime(Int(($0 * 60).rounded())) },
      chartSummary: { visibleDays, months in
        let studied = visibleDays.count(where: { $0.step > 0 })
        return studied == 0
          ? String(
            localized: "No study in the past \(months) months", table: "Progress",
            locale: .appLanguage)
          : String(
            localized: "\(studied) study days in the past \(months) months", table: "Progress",
            locale: .appLanguage)
      })
  }
}

extension ActivityProgressDay {
  /// Shaded and played by minutes studied, as main's calendar is.
  func calendarDay(maximumSeconds: Int, today: String) -> CalendarDay {
    CalendarDay(
      date: date,
      step: CalendarSteps.activity(
        studied: activitiesCompleted > 0, seconds: timeSpentSeconds,
        maximumSeconds: maximumSeconds),
      detail: ChartPointDetail(label: PlanDate.text(date.id, today: today), value: studyDetail),
      value: Double(timeSpentSeconds) / 60)
  }

  /// Main's day detail: the time studied, then the lessons finished.
  var studyDetail: String {
    if activitiesCompleted == 0 {
      return String(
        localized: "No study", table: "Progress", comment: "A calendar day without study")
    }

    let time = timeSpentSeconds > 0 ? progressLearningTime(timeSpentSeconds) : nil
    let lessons =
      lessonCompletions > 0
      ? String(localized: "\(lessonCompletions) lessons", table: "Progress", locale: .appLanguage)
      : nil
    let facts = [time, lessons].compactMap(\.self)

    return facts.isEmpty
      ? String(localized: "Studied", table: "Progress", comment: "A calendar day with study")
      : facts.joinedFacts()
  }
}
