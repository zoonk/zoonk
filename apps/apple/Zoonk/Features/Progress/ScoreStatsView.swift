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
        label: Text(StatsSection.score.title),
        value: Text(verbatim: metricPercent(performance.score)),
        systemImage: "chart.line.uptrend.xyaxis", tone: .success,
        detail: Text(
          "\(performance.correctAnswers.formatted()) of \(performance.totalAnswers.formatted()) right in the last \(90) days",
          tableName: "Progress")
      )
    }
  }
}

struct ScoreTrendChart: View {
  let score: ScoreProgress

  @Environment(ChartInspection.self) private var inspection
  @State private var selectedDate: Date?
  @State private var axisWidth = 0.0
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.legibilityWeight) private var legibility

  private var axisLabels: [ScoreAxisLabel] {
    let font = TypeStyle.data.uiFont(typeSize, legibility: legibility)
    let labelWidth =
      points.map { (weekLabel($0.date) as NSString).size(withAttributes: [.font: font]).width }
      .max() ?? 0
    return scoreAxisLabels(count: points.count, width: axisWidth, labelWidth: labelWidth + 8)
  }

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
      AxisMarks(preset: .aligned, values: axisLabels.map { points[$0.index].date }) { value in
        // On its point, not after it: the ends start and stop at theirs, so none leaves the plot.
        AxisValueLabel(
          centered: false,
          anchor: axisLabels[value.index].anchor,
          collisionResolution: .disabled,
          horizontalSpacing: 0
        ) {
          if let date = value.as(Date.self) {
            Text(weekLabel(date)).typeStyle(.data)
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
    .chartPlotStyle { plot in
      plot.onGeometryChange(for: Double.self) {
        $0.size.width
      } action: {
        axisWidth = $0
      }
    }
    .accessibilityLabel(
      Text("Weekly score trend", tableName: "Progress")
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
    PlanDate.text(PlanDate.isoDate(date), today: PlanDate.today())
  }
}
