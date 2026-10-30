import Charts
import SwiftUI

struct ScoreStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.score.state, retry: { await progress.score.refresh() }) { score in
      ScoreTiles(performance: score.performance)
      ScoreTrendChart(score: score)
      StatsLine(
        text: Text(
          "Every answer counts the same, so harder lessons can lower your score for a while.",
          tableName: "Progress", comment: "Under the Score trend: what moves the score"))
    }
    .loads(progress.score)
  }
}

private struct ScoreTiles: View {
  let performance: ScorePerformance
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [3, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(StatsSection.score.title),
        value: Text(verbatim: metricPercent(performance.score)),
        systemImage: "target", tone: .success,
        detail: Text(
          "Right answers", tableName: "Progress", comment: "Under the Score: what it is a share of")
      )

      StatTile(
        label: Text("Right", tableName: "Progress", comment: "Tile: right answers of all answers"),
        value: Text(
          verbatim:
            "\(performance.correctAnswers.formatted())/\(performance.totalAnswers.formatted())"),
        systemImage: "checkmark", tone: .success,
        detail: Text(
          "Of all your answers", tableName: "Progress", comment: "Under the right answers count"),
        spokenValue: Text(
          "\(performance.correctAnswers) of \(performance.totalAnswers)", tableName: "Progress",
          comment: "Spoken right answers of all answers")
      )

      StatTile(
        label: Text("Period", tableName: "Progress", comment: "Tile: the days Score counts"),
        value: bigQuantity(dayCount(90)),
        systemImage: "calendar",
        detail: Text(
          "Back from today", tableName: "Progress",
          comment: "Under the Score's period: the days counted backward from today")
      )
    }
  }
}

struct ScoreTrendChart: View {
  let score: ScoreProgress

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
        .foregroundStyle(Color(.separator))
        .annotation(position: .top, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
          VStack(alignment: .leading, spacing: 2) {
            Text(weekLabel(selected.date))
              .font(.caption.monospacedDigit())
              .foregroundStyle(.secondary)
            Text(metricPercent(selected.point.performance.score))
              .font(.subheadline.weight(.medium).monospacedDigit())
              .foregroundStyle(.success)
            Text(
              "\(selected.point.performance.totalAnswers) answers", tableName: "Progress",
              comment: "A count of answers"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
          }
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
          .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(.separator))
          .accessibilityHidden(true)
        }
      }
    }
    .chartYScale(domain: 0...100)
    .chartYAxis {
      AxisMarks(position: .leading, values: [0, 25, 50, 75, 100]) {
        AxisGridLine()
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
