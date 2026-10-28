import SwiftUI

/// Energy: its three numbers (now, its average and the days at full), the past 12 months in its
/// yellow, and one line on how it moves.
struct EnergyStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.energy.state, retry: { await progress.energy.refresh() }) {
      energy in
      EnergyTiles(energy: energy)
      EnergyCalendar(energy: energy)
      StatsLine(
        text: Text(
          "Every lesson you finish raises your Energy. On days off it drops a little, and your belt and progress stay.",
          tableName: "Progress",
          comment: "Under the Energy calendar: how Energy moves and what never does"))
    }
    .loads(progress.energy)
  }
}

private struct EnergyTiles: View {
  let energy: EnergyProgress
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [3, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(StatsSection.energy.title),
        value: Text(verbatim: wholePercent(energy.currentEnergy)),
        systemImage: "bolt.fill", tone: .energy,
        detail: Text("Today", tableName: "Progress", comment: "Under the Energy now: it's today's")
      )

      StatTile(
        label: Text(
          "Average", tableName: "Progress", comment: "Tile: the learner's average Energy"),
        value: Text(verbatim: energy.insights.map { metricPercent($0.averageEnergy) } ?? "–"),
        systemImage: "gauge.with.dots.needle.50percent", tone: .energy,
        detail: Text(
          "Since you started", tableName: "Progress", comment: "Under the average Energy: over what"
        )
      )

      StatTile(
        label: Text(
          "At 100%", tableName: "Progress",
          comment: "Tile: how many days the learner's Energy was full"),
        value: energy.insights.map { bigQuantity(dayCount($0.fullEnergyDays)) }
          ?? Text(verbatim: "–"),
        systemImage: "battery.100percent", tone: .energy,
        detail: Text(
          "Days with full Energy", tableName: "Progress",
          comment: "Under the days at full Energy: what they count")
      )
    }
  }
}

/// "12 days", as every tile counts days.
func dayCount(_ count: Int) -> String {
  count == 0
    ? String(localized: "0 days", table: "Progress", comment: "A count of no days")
    : String(localized: "\(count) days", table: "Progress", comment: "A count of days")
}

/// Energy over the past 12 months in its yellow, softened at every step: most days sit in the upper
/// steps, and at full strength they'd be the loudest thing on a quiet page.
private struct EnergyCalendar: View {
  let energy: EnergyProgress

  var body: some View {
    let formatDay = calendarDayFormatter(newest: energy.days.last?.date)

    StatsCalendar(
      title: Text(
        "Past 12 months", tableName: "Progress",
        comment: "Title of a calendar of the past year's days"),
      gridLabel: Text(
        "Energy by day", tableName: "Progress", comment: "Spoken name of the Energy calendar"),
      legendLabel: Text(
        "Energy intensity from low to high", tableName: "Progress",
        comment: "Spoken key of the Energy calendar's shades"),
      low: Text("Low", tableName: "Progress", comment: "Low end of the Energy calendar's key"),
      high: Text("High", tableName: "Progress", comment: "High end of the Energy calendar's key"),
      shades: [
        Color(.systemFill), Color.energy.opacity(0.15), Color.energy.opacity(0.3),
        Color.energy.opacity(0.45), Color.energy.opacity(0.6), Color.energy.opacity(0.8),
      ],
      days: energy.days.map { day in
        let date = formatDay(day.date)

        return CalendarDay(
          date: day.date,
          step: CalendarSteps.energy(day.energy),
          label: day.energy.map {
            String(
              localized: "\(date) · \(metricPercent($0)) Energy", table: "Progress",
              comment: "An Energy calendar day: its date and its Energy")
          }
            ?? String(
              localized: "\(date) · No Energy recorded", table: "Progress",
              comment: "An Energy calendar day without Energy"),
          value: day.energy)
      },
      chartTitle: String(
        localized: "Energy by day", table: "Progress", comment: "Spoken name of the Energy calendar"
      ),
      chartSummary: energy.insights.map {
        String(
          localized: "Average \(metricPercent($0.averageEnergy))", table: "Progress",
          comment: "The learner's average Energy")
      } ?? "")
  }
}
