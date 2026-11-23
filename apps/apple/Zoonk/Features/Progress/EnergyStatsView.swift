import SwiftUI

struct EnergyStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.energy.state, retry: { await progress.energy.refresh() }) {
      energy in
      EnergyTiles(energy: energy)
      EnergyCalendar(energy: energy)
    }
    .loads(progress.energy)
  }
}

private struct EnergyTiles: View {
  let energy: EnergyProgress
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [2, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(StatsSection.energy.title),
        value: Text(verbatim: wholePercent(energy.currentEnergy)),
        systemImage: "bolt.fill", tone: .energy,
        detail: Text("Today", tableName: "Progress", comment: "Under the Energy now: it's today's")
      )

      StatTile(
        label: Text(
          "Days at 100%", tableName: "Progress",
          comment: "Tile: how many days the learner's Energy was full"),
        value: Text(
          verbatim: energy.insights.map {
            $0.fullEnergyDays.formatted(.number.locale(.appLanguage))
          } ?? "–"),
        systemImage: "battery.100percent", tone: .energy)
    }
  }
}

/// Softened at every step: most days sit in the upper steps, and at full strength they'd be the
/// loudest thing on a quiet page.
private struct EnergyCalendar: View {
  let energy: EnergyProgress

  var body: some View {
    let today = PlanDate.today()

    StatsCalendar(
      gridLabel: Text(
        "Energy by day", tableName: "Progress"),
      legendTitle: Text("Energy", tableName: "Progress"),
      legendLabel: Text(
        "Energy intensity from low to high", tableName: "Progress"),
      low: Text("Low", tableName: "Progress", comment: "Low end of the Energy calendar's key"),
      high: Text("High", tableName: "Progress", comment: "High end of the Energy calendar's key"),
      shades: [
        Color.surface3, Color.energy.opacity(0.15), Color.energy.opacity(0.3),
        Color.energy.opacity(0.45), Color.energy.opacity(0.6), Color.energy.opacity(0.8),
      ],
      days: energy.days.map { day in
        CalendarDay(
          date: day.date,
          step: CalendarSteps.energy(day.energy),
          detail: ChartPointDetail(
            label: PlanDate.text(day.date.id, today: today),
            value: day.energy.map {
              String(
                localized: "\(metricPercent($0)) Energy", table: "Progress",
                comment:
                  "A calendar day's value, shown in a small tooltip under the day's date: the buddy's Energy that day, such as “72% Energy”."
              )
            }
              ?? String(
                localized: "No Energy recorded", table: "Progress",
                comment:
                  "A calendar day's value, shown in a small tooltip under the day's date, for a day without an Energy value."
              )
          ),
          value: day.energy)
      },
      chartTitle: String(
        localized: "Energy by day", table: "Progress", comment: "Spoken name of the Energy calendar"
      ),
      valueText: { metricPercent($0) },
      chartSummary: { visibleDays, _ in
        let values = visibleDays.compactMap(\.value)
        guard !values.isEmpty else { return "" }
        let average = values.reduce(0, +) / Double(values.count)
        return String(
          localized: "Average \(metricPercent(average))", table: "Progress",
          comment: "The learner's average Energy")
      })
  }
}
