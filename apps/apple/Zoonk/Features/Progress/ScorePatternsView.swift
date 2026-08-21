import Charts
import SwiftUI

struct ScorePatternsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    ProgressDetailLoadStateView(
      state: progress.patternsState,
      emptyTitle: LocalizedStringResource(
        "No patterns yet",
        table: "Progress",
        comment: "Title shown before the learner has enough answers for score patterns"),
      emptyDescription: LocalizedStringResource(
        "Answer questions to discover when you perform best.",
        table: "Progress",
        comment: "Guidance shown before the learner has score patterns"),
      systemImage: "chart.xyaxis.line",
      retry: { await progress.loadPatterns(force: true) }
    ) { patterns in
      ScorePatternsContent(patterns: patterns)
    }
    .refreshesProgress {
      await progress.loadPatterns()
    }
  }
}

private struct ScorePatternsContent: View {
  let patterns: ScorePatterns

  private var weekdays: [WeekdayScorePattern] {
    patterns.weekdays.sorted { $0.weekday.order < $1.weekday.order }
  }

  var body: some View {
    ProgressDetailPage {
      PatternHero(patterns: patterns)

      if patterns.strongestWeekday != nil || patterns.strongestDaypart != nil {
        ProgressDetailMetricGrid {
          if let strongestWeekday = patterns.strongestWeekday {
            ProgressDetailMetric(
              label: Text(
                "Strongest weekday",
                tableName: "Progress",
                comment: "Label for the weekday with the learner's strongest accuracy"),
              value: Text(verbatim: strongestWeekday.weekday.localizedTitle),
              systemImage: "calendar",
              tint: ProgressDestination.patterns.tint)
          }

          if let strongestDaypart = patterns.strongestDaypart {
            ProgressDetailMetric(
              label: Text(
                "Strongest time",
                tableName: "Progress",
                comment: "Label for the time of day with the learner's strongest accuracy"),
              value: Text(strongestDaypart.daypart.localizedTitle),
              systemImage: strongestDaypart.daypart.systemImage,
              tint: ProgressDestination.patterns.tint)
          }
        }
      }

      ProgressDetailSection(
        title: Text(
          "Weekly rhythm",
          tableName: "Progress",
          comment: "Title above accuracy grouped by weekday"),
        subtitle: Text(
          "Accuracy by weekday over the past 90 days.",
          tableName: "Progress",
          comment: "Description of the weekday accuracy chart")
      ) {
        WeekdayPatternChart(
          patterns: weekdays,
          strongestWeekday: patterns.strongestWeekday?.weekday)
      }

      ProgressDetailSection(
        title: Text(
          "Throughout the day",
          tableName: "Progress",
          comment: "Title above accuracy grouped by time of day"),
        subtitle: Text(
          "Accuracy by time of day over the past 90 days.",
          tableName: "Progress",
          comment: "Description of the time-of-day accuracy patterns")
      ) {
        VStack(spacing: 0) {
          ForEach(patterns.dayparts) { pattern in
            DaypartPatternRow(
              pattern: pattern,
              isStrongest: pattern.daypart == patterns.strongestDaypart?.daypart)

            if pattern.id != patterns.dayparts.last?.id {
              Divider()
                .padding(.leading, 46)
            }
          }
        }
      }

      ProgressDetailExplanation(
        title: Text(
          "Your learning rhythm",
          tableName: "Progress",
          comment: "Title explaining how score patterns can be used"),
        description: Text(
          "Patterns use your answers from the past 90 days. Use them as a guide, not a rule—learning at any time still moves you forward.",
          tableName: "Progress",
          comment: "Explains the rolling window and purpose of score patterns"),
        systemImage: "sparkles",
        tint: ProgressDestination.patterns.tint)
    }
  }
}

private struct PatternHero: View {
  let patterns: ScorePatterns

  var body: some View {
    if let strongestDaypart = patterns.strongestDaypart {
      ProgressDetailHero(
        title: Text(
          "Your strongest time",
          tableName: "Progress",
          comment: "Label above the learner's strongest time of day"),
        value: Text(strongestDaypart.daypart.localizedTitle),
        description: Text(
          "Accuracy: \(strongestDaypart.performance.score / 100, format: .percent.precision(.fractionLength(0))) · Answers: \(strongestDaypart.performance.totalAnswers)",
          tableName: "Progress",
          comment: "Accuracy and answer count for the learner's strongest time of day"),
        systemImage: strongestDaypart.daypart.systemImage,
        tint: ProgressDestination.patterns.tint)
    } else if let strongestWeekday = patterns.strongestWeekday {
      ProgressDetailHero(
        title: Text(
          "Your strongest weekday",
          tableName: "Progress",
          comment: "Label above the learner's strongest weekday"),
        value: Text(verbatim: strongestWeekday.weekday.localizedTitle),
        description: Text(
          "Accuracy: \(strongestWeekday.performance.score / 100, format: .percent.precision(.fractionLength(0))) · Answers: \(strongestWeekday.performance.totalAnswers)",
          tableName: "Progress",
          comment: "Accuracy and answer count for the learner's strongest weekday"),
        systemImage: "calendar",
        tint: ProgressDestination.patterns.tint)
    } else {
      ProgressDetailHero(
        title: Text(
          "Past 90 days",
          tableName: "Progress",
          comment: "Fixed period label above the empty score patterns summary"),
        value: Text(
          "No patterns yet",
          tableName: "Progress",
          comment: "Headline shown when no weekday or daypart has answers"),
        description: Text(
          "Answer questions to discover when you perform best.",
          tableName: "Progress",
          comment: "Guidance shown when no weekday or daypart has answers"),
        systemImage: "chart.xyaxis.line",
        tint: ProgressDestination.patterns.tint)
    }
  }
}

private struct WeekdayPatternChart: View {
  let patterns: [WeekdayScorePattern]
  let strongestWeekday: ProgressWeekday?

  var body: some View {
    Chart(patterns) { pattern in
      if pattern.performance.hasAnswers {
        BarMark(
          x: .value(
            String(
              localized: "Weekday",
              table: "Progress",
              comment: "Chart axis value describing a weekday"),
            pattern.weekday.rawValue),
          y: .value(
            String(
              localized: "Accuracy",
              table: "Progress",
              comment: "Chart axis value describing answer accuracy"),
            pattern.performance.score)
        )
        .foregroundStyle(
          pattern.weekday == strongestWeekday
            ? ProgressDestination.patterns.tint
            : ProgressDestination.patterns.tint.opacity(0.42)
        )
        .cornerRadius(4)
        .accessibilityLabel(Text(verbatim: pattern.weekday.localizedTitle))
        .accessibilityValue(
          Text(
            "Accuracy: \(pattern.performance.score / 100, format: .percent.precision(.fractionLength(0))) · Answers: \(pattern.performance.totalAnswers)",
            tableName: "Progress",
            comment: "Accessible weekday accuracy and answer count in the patterns chart"))
      } else {
        PointMark(
          x: .value(
            String(
              localized: "Weekday",
              table: "Progress",
              comment: "Chart axis value describing a weekday"),
            pattern.weekday.rawValue),
          y: .value(
            String(
              localized: "No answers",
              table: "Progress",
              comment: "Chart value indicating a weekday has no answers"),
            5)
        )
        .foregroundStyle(.clear)
        .annotation(position: .overlay) {
          Text(verbatim: "—")
            .font(.headline)
            .foregroundStyle(.secondary)
        }
        .accessibilityLabel(Text(verbatim: pattern.weekday.localizedTitle))
        .accessibilityValue(
          Text(
            "No answers",
            tableName: "Progress",
            comment: "Accessible value for a weekday with no answers"))
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
      AxisMarks(values: ProgressWeekday.allCases.map(\.rawValue)) { value in
        AxisValueLabel {
          if let rawValue = value.as(String.self),
            let weekday = ProgressWeekday(rawValue: rawValue)
          {
            Text(verbatim: weekday.shortLocalizedTitle)
          }
        }
      }
    }
    .chartPlotStyle { plotArea in
      plotArea.clipped()
    }
    .frame(height: 240)
    .accessibilityLabel(
      Text(
        "Accuracy by weekday",
        tableName: "Progress",
        comment: "Accessibility label for the weekday accuracy chart"))
  }
}

private struct DaypartPatternRow: View {
  let pattern: DaypartScorePattern
  let isStrongest: Bool

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .top, spacing: 12) {
        icon
        identity
        Spacer(minLength: 12)
        performance(alignment: .trailing)
      }

      HStack(alignment: .top, spacing: 12) {
        icon

        VStack(alignment: .leading, spacing: 8) {
          identity
          performance(alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(.vertical, 10)
    .accessibilityElement(children: .combine)
  }

  private var icon: some View {
    Image(systemName: pattern.daypart.systemImage)
      .frame(width: 34, height: 34)
      .foregroundStyle(isStrongest ? .white : ProgressDestination.patterns.tint)
      .background(
        isStrongest
          ? ProgressDestination.patterns.tint
          : ProgressDestination.patterns.tint.opacity(0.12),
        in: Circle()
      )
      .accessibilityHidden(true)
  }

  private var identity: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(pattern.daypart.localizedTitle)
        .font(.headline)

      Text(verbatim: pattern.daypart.localizedTimeRange)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)

      if isStrongest {
        Label {
          Text(
            "Strongest",
            tableName: "Progress",
            comment: "Badge identifying the learner's strongest score pattern")
        } icon: {
          Image(systemName: "star.fill")
        }
        .font(.caption2.bold())
        .foregroundStyle(ProgressDestination.patterns.tint)
      }
    }
  }

  private func performance(alignment: HorizontalAlignment) -> some View {
    VStack(alignment: alignment, spacing: 2) {
      if pattern.performance.hasAnswers {
        Text(
          pattern.performance.score / 100,
          format: .percent.precision(.fractionLength(0))
        )
        .font(.headline)
        .foregroundStyle(ProgressDestination.patterns.tint)

        Text(
          "Answers: \(pattern.performance.totalAnswers)",
          tableName: "Progress",
          comment: "Answer count for a time-of-day score pattern"
        )
        .font(.caption)
        .foregroundStyle(.secondary)
      } else {
        Text(
          "No answers",
          tableName: "Progress",
          comment: "Value shown when a time-of-day pattern has no answers"
        )
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
      }
    }
  }
}
