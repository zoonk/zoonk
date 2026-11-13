import Charts
import SwiftUI

struct ScoreStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.score.state, retry: { await progress.score.refresh() }) { score in
      ScoreTiles(performance: score.performance)
      ScoreTrendChart(score: score)
    }
    .loads(progress.score)
  }
}

/// One tile, spanning its row.
private struct ScoreTiles: View {
  let performance: ScorePerformance
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(
          "Last 90 days", tableName: "Progress",
          comment: "Tile: the share of right answers over the last 90 days"),
        value: Text(verbatim: metricPercent(performance.score)),
        systemImage: "target", tone: .success,
        detail: Text(
          "\(performance.correctAnswers.formatted()) of \(performance.totalAnswers.formatted())",
          tableName: "Progress",
          comment:
            "Under the share of right answers: right answers of all answers, as in 153 of 197")
      )
    }
  }
}

struct ScoreTrendChart: View {
  let score: ScoreProgress

  @Environment(ChartInspection.self) private var inspection
  @State private var selectedDate: Date?

  private var points: [ScoreWeek] {
    score.dataPoints.compactMap { point in
      point.date.date(in: .gmt).map { ScoreWeek(date: $0, point: point) }
    }
  }

  private var selected: ScoreWeek? {
    guard let selectedDate else {
      return nil
    }

    return points.min {
      abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate))
    }
  }

  var body: some View {
    Chart {
      ForEach(points) { week in
        let (date, point) = (week.date, week.point)

        LineMark(
          x: .value(Text("Week", tableName: "Progress", comment: "Score chart axis: a week"), date),
          y: .value(Text(StatsSection.score.title), point.performance.score)
        )
        .interpolationMethod(.monotone)
        .lineStyle(StrokeStyle(lineWidth: 2))
        .foregroundStyle(.success)

        PointMark(
          x: .value(Text("Week", tableName: "Progress", comment: "Score chart axis: a week"), date),
          y: .value(Text(StatsSection.score.title), point.performance.score)
        )
        .symbolSize(selected?.point == point ? 64 : 24)
        .foregroundStyle(.success)
        .accessibilityLabel(Text(weekLabel(date)))
        .accessibilityValue(
          Text(
            "\(metricPercent(point.performance.score)) across \(point.performance.totalAnswers) answers",
            tableName: "Progress",
            comment: "A score spoken: its share of right answers and how many answers it holds"))
      }

      if let selected {
        RuleMark(
          x: .value(
            Text("Week", tableName: "Progress", comment: "Score chart axis: a week"), selected.date)
        )
        .foregroundStyle(Color.border)
        .annotation(position: .top, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
          ChartTooltip(
            detail: ChartPointDetail(
              label: weekLabel(selected.date),
              value: metricPercent(selected.point.performance.score),
              note: String(
                localized: "\(selected.point.performance.totalAnswers) answers", table: "Progress",
                comment: "A count of answers")),
            valueColor: .successText)
        }
      }
    }
    .chartYScale(domain: 0...100)
    .chartYAxis {
      AxisMarks(position: .leading, values: [0, 25, 50, 75, 100]) {
        AxisGridLine().foregroundStyle(.vizGrid)
        AxisValueLabel()
      }
    }
    .chartXScale(range: .plotDimension(padding: 16))
    .chartXAxis {
      AxisMarks(values: points.map(\.date)) { value in
        AxisValueLabel(
          anchor: value.index == 0
            ? .topLeading : value.index == value.count - 1 ? .topTrailing : .top,
          collisionResolution: .greedy(minimumSpacing: 8)
        ) {
          if let date = value.as(Date.self) {
            Text(weekLabel(date))
          }
        }
      }
    }
    .chartXSelection(value: $selectedDate)
    .onChange(of: selectedDate == nil) { _, isIdle in
      if !isIdle {
        inspection.close()
      }
    }
    .frame(height: 220)
    .accessibilityLabel(
      Text("Weekly score trend", tableName: "Progress", comment: "Spoken name of the Score chart")
    )
    .accessibilityValue(
      Text(
        "\(metricPercent(score.performance.score)) across \(score.performance.totalAnswers) answers",
        tableName: "Progress",
        comment: "A score spoken: its share of right answers and how many answers it holds"))
  }

  private struct ScoreWeek: Identifiable {
    let date: Date
    let point: ScoreProgressPoint

    var id: ProgressDate { point.date }
  }

  private func weekLabel(_ date: Date) -> String {
    var format = Date.FormatStyle.dateTime.month(.abbreviated).day()
    format.timeZone = .gmt
    return date.formatted(format)
  }
}
