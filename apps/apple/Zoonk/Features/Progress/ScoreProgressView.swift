import Charts
import SwiftUI

struct ScoreProgressView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    ProgressDetailLoadStateView(
      state: progress.scoreState,
      emptyTitle: LocalizedStringResource(
        "No Score yet",
        table: "Progress",
        comment: "Title shown before the learner answers a question"),
      emptyDescription: LocalizedStringResource(
        "Answer questions in your lessons to see your Score.",
        table: "Progress",
        comment: "Guidance shown before the learner has a Score"),
      systemImage: "target",
      retry: { await progress.loadScore(force: true) }
    ) { score in
      ScoreProgressContent(score: score)
    }
    .refreshesProgress {
      await progress.loadScore()
    }
  }
}

private struct ScoreProgressContent: View {
  let score: ScoreProgress

  private var recordedPoints: [ScoreProgressPoint] {
    score.dataPoints.filter(\.performance.hasAnswers)
  }

  var body: some View {
    if score.performance.hasAnswers {
      ProgressDetailPage {
        ProgressDetailHero(
          title: Text(
            "Past 90 days",
            tableName: "Progress",
            comment: "Fixed period label above the learner's Score"),
          value: Text(
            score.performance.score / 100,
            format: .percent.precision(.fractionLength(0))),
          description: Text(
            "Correct answers: \(score.performance.correctAnswers) of \(score.performance.totalAnswers)",
            tableName: "Progress",
            comment: "Summary of correct and total answers in the Score period"),
          systemImage: "target",
          tint: ProgressDestination.score.tint)

        ProgressDetailSection(
          title: Text(
            "Weekly trend",
            tableName: "Progress",
            comment: "Title above the weekly Score chart"),
          subtitle: Text(
            "Answer accuracy over the past 90 days.",
            tableName: "Progress",
            comment: "Description of the weekly Score chart")
        ) {
          if recordedPoints.isEmpty {
            ProgressDetailNoChartData()
          } else {
            ScoreTrendChart(points: recordedPoints)
          }
        }

        ProgressDetailMetricGrid {
          ProgressDetailMetric(
            label: Text(
              "Correct answers",
              tableName: "Progress",
              comment: "Label for correct answers in the Score period"),
            value: Text(score.performance.correctAnswers, format: .number),
            systemImage: "checkmark.circle",
            tint: ProgressDestination.score.tint)

          ProgressDetailMetric(
            label: Text(
              "Incorrect answers",
              tableName: "Progress",
              comment: "Label for incorrect answers in the Score period"),
            value: Text(score.performance.incorrectAnswers, format: .number),
            systemImage: "xmark.circle",
            tint: .orange)

          ProgressDetailMetric(
            label: Text(
              "Total answers",
              tableName: "Progress",
              comment: "Label for all answers in the Score period"),
            value: Text(score.performance.totalAnswers, format: .number),
            systemImage: "text.bubble",
            tint: ProgressDestination.score.tint)
        }

        ProgressDetailExplanation(
          title: Text(
            "What is Score?",
            tableName: "Progress",
            comment: "Title explaining the Score metric"),
          description: Text(
            "Score is the percentage of questions you answered correctly over the past 90 days. Every answer counts equally, so harder lessons can lower it for a while. That's part of learning.",
            tableName: "Progress",
            comment: "Explanation of how the rolling Score is calculated"),
          systemImage: "target",
          tint: ProgressDestination.score.tint)
      }
    } else {
      ContentUnavailableView {
        Label {
          Text(
            "No Score yet",
            tableName: "Progress",
            comment: "Title shown when a Score response has no answered questions")
        } icon: {
          Image(systemName: "target")
        }
      } description: {
        Text(
          "Answer questions in your lessons to see your Score.",
          tableName: "Progress",
          comment: "Guidance shown when a Score response has no answered questions")
      }
    }
  }
}

private struct ScoreTrendChart: View {
  let points: [ScoreProgressPoint]

  var body: some View {
    Chart(points) { point in
      if let date = point.date.date() {
        LineMark(
          x: .value(
            String(
              localized: "Week",
              table: "Progress",
              comment: "Chart axis value describing a Score week"),
            date),
          y: .value(
            String(
              localized: "Score",
              table: "Progress",
              comment: "Chart axis value describing answer accuracy"),
            point.performance.score)
        )
        .foregroundStyle(ProgressDestination.score.tint)
        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
        .symbol(.circle)
        .accessibilityLabel(
          Text(date, format: .dateTime.month(.wide).day().year())
        )
        .accessibilityValue(
          Text(
            "Accuracy: \(point.performance.score / 100, format: .percent.precision(.fractionLength(0)))",
            tableName: "Progress",
            comment: "Accessible weekly accuracy value in the Score chart"))
      }
    }
    .chartYScale(domain: 0...100)
    .chartYAxis {
      AxisMarks(position: .leading, values: [0.0, 25.0, 50.0, 75.0, 100.0]) { value in
        AxisGridLine()
        AxisValueLabel {
          if let score = value.as(Double.self) {
            Text(score / 100, format: .percent.precision(.fractionLength(0)))
          }
        }
      }
    }
    .chartXAxis {
      AxisMarks(values: .stride(by: .month)) {
        AxisGridLine()
        AxisTick()
        AxisValueLabel(format: .dateTime.month(.abbreviated), centered: true)
      }
    }
    .frame(height: 240)
    .accessibilityLabel(
      Text(
        "Weekly Score trend",
        tableName: "Progress",
        comment: "Accessibility label for the weekly answer accuracy chart"))
  }
}
