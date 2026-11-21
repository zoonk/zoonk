import SwiftUI

/// A written part's page: where the learner stands in points, how the answers move, and each answer
/// (main's `SubjectWrittenScore`).
struct SubjectWrittenSections: View {
  let written: GoalPlan.WrittenPractice.Subject

  var body: some View {
    switch written.shownScale {
    case .points:
      SubjectWrittenPoints(
        points: written.points, decimals: written.points.decimals ?? written.decimals)
    case .levels:
      SubjectWrittenLevels(points: written.points)
    }
    SubjectWrittenTrend(samples: Array(written.trend.suffix(4)))
    SubjectWrittenAnswers(answers: written.answers)
  }
}

/// No points estimate for this test yet: how answers are graded, instead of "not measured".
private struct SubjectWrittenLevels: View {
  let points: WrittenPartPoints

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Your answers are graded by level. A points estimate isn't available for this test yet.",
          tableName: "Plan")
        if let minimum = points.minimum {
          minimumText(minimum, max: points.max)
        }
      }
      .typeStyle(.body)
      .foregroundStyle(.mutedForeground)
    }
  }
}

/// The part's estimated points, its own minimum, and each question's share of them.
private struct SubjectWrittenPoints: View {
  let points: WrittenPartPoints
  let decimals: Int?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text("Estimated score", tableName: "Plan")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

        if let range = points.range, let max = points.max {
          PointsReadout(range: range, max: max, decimals: decimals)
        } else {
          Text("Not measured yet", tableName: "Plan")
            .typeStyle(.stepHeading)
        }

        if let max = points.max {
          let minimum = points.minimum.flatMap { minimumShare($0, max: max) }.map { $0 * max }

          if let range = points.range {
            RangeBar(range: range, max: max, minimum: minimum)
          } else {
            UnmeasuredBar()
          }
        }

        if let minimum = points.minimum {
          MinimumLegend(minimumText(minimum, max: points.max))
        }
      }
      .padding(.vertical, 4)

      ForEach(points.tasks) { task in
        LabeledContent {
          if let range = task.range, let max = task.max {
            Text(verbatim: WritingLabels.range(range, of: max, decimals: decimals))
              .typeStyle(.data)
              .foregroundStyle(Color(.foreground))
          } else {
            Text("Not measured yet", tableName: "Plan")
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        } label: {
          Text(WritingLabels.taskName(task.writingTask, title: task.name))
        }
      }
    }
  }
}

/// Where a minimum falls on a scale, as a share of it.
private func minimumShare(_ minimum: PointsMinimum, max: Double) -> Double? {
  minimum.unit == .percent ? minimum.value / 100 : max > 0 ? minimum.value / max : nil
}

/// "Minimum to pass: 50 of 100", or a share of the points when the notice gives one.
private func minimumText(_ minimum: PointsMinimum, max: Double?) -> Text {
  if minimum.unit == .percent {
    return Text(
      "Minimum to pass: \(WritingLabels.share(minimum.value / 100)) of the points",
      tableName: "Plan")
  }

  guard let max else {
    return Text(
      "Minimum to pass: \(WritingLabels.points(minimum.value))", tableName: "Plan")
  }

  return Text(
    "Minimum to pass: \(WritingLabels.points(minimum.value)) of \(WritingLabels.points(max))",
    tableName: "Plan")
}

/// One small bar per answer, oldest first, the latest in full color.
private struct SubjectWrittenTrend: View {
  let samples: [GoalPlan.WrittenPractice.Subject.Sample]

  var body: some View {
    if let latest = samples.last {
      Section {
        row(
          Text("Content", tableName: "Essay"),
          values: samples.map(\.contentShare), last: share(latest.contentShare))
        row(
          Text(
            "Presentation and structure", tableName: "Plan"),
          values: samples.map(\.presentationShare), last: share(latest.presentationShare))
        row(
          Text("Language errors", tableName: "Essay"),
          values: samples.map { Double($0.errors) },
          last: WritingLabels.errors(latest.errors))
      } header: {
        SectionTitle(
          Text("Your progress", tableName: "Plan", comment: "How written answers move")
        ) {
          Text(
            "last \(samples.count) answers", tableName: "Plan",
            comment: "How many answers the written trend shows"
          )
          .typeStyle(.data)
        }
      }
    }
  }

  private func share(_ value: Double?) -> String {
    value.map(WritingLabels.share) ?? ""
  }

  @ViewBuilder
  private func row(_ label: Text, values: [Double?], last: String) -> some View {
    if values.contains(where: { $0 != nil }) {
      LabeledContent {
        HStack(spacing: 12) {
          TrendBars(values: values)
          Text(verbatim: last)
            .typeStyle(.data)
            .foregroundStyle(Color(.foreground))
            .frame(minWidth: 56, alignment: .trailing)
        }
      } label: {
        label
      }
    }
  }
}

private struct TrendBars: View {
  let values: [Double?]
  @ScaledMetric(relativeTo: .footnote) private var height = 20.0

  var body: some View {
    let peak = max(1, values.compactMap(\.self).max() ?? 0)

    HStack(alignment: .bottom, spacing: 2) {
      ForEach(Array(values.enumerated()), id: \.offset) { index, value in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(
            value == nil
              ? Color.surface3
              : index == values.count - 1 ? Color.success : Color.success.opacity(0.4)
          )
          .frame(width: 6, height: height * max(0.2, (value ?? 0) / peak))
      }
    }
    .frame(height: height, alignment: .bottom)
    .accessibilityHidden(true)
  }
}

/// Each first answer, which opens as its result was read.
private struct SubjectWrittenAnswers: View {
  @Environment(AppRouter.self) private var router

  let answers: [GoalPlan.WrittenPractice.Subject.Answer]

  var body: some View {
    if !answers.isEmpty {
      Section {
        ForEach(answers) { answer in
          Button {
            router.open(.writingAnswer(attemptId: answer.attemptId))
          } label: {
            ListRow(
              Text(answer.title), description: criteriaResult(answer).map { Text($0) },
              descriptionFacts: facts(answer)
            ) {
              EmptyView()
            } trailing: {
              if let range = answer.range {
                Text(verbatim: WritingLabels.range(range, decimals: answer.decimals))
                  .typeStyle(.data)
                  .foregroundStyle(Color(.foreground))
              }
            }
            .disclosureChevron()
          }
        }
      } header: {
        SectionTitle(Text("Your answers", tableName: "Plan")) {
          Text(verbatim: "\(answers.count)")
            .typeStyle(.data)
        }
      }
    }
  }

  /// The server's count of the lines sent, against the question's limit when it has one.
  private func lineFact(_ answer: GoalPlan.WrittenPractice.Subject.Answer) -> String? {
    switch (answer.estimatedLines, answer.lines) {
    case (nil, nil):
      nil
    case (nil, let limit?):
      String(localized: "\(limit) lines", table: "Plan", comment: "A written question's line limit")
    case (let used?, nil):
      String(
        localized: "about \(used) lines", table: "Essay",
        comment: "An answer's estimated handwritten lines")
    case (let used?, let limit?):
      String(
        localized: "about \(used) of \(limit) lines", table: "Essay")
    }
  }

  /// A levels answer's result, on its own line: as a trailing value it would squeeze the title.
  private func criteriaResult(_ answer: GoalPlan.WrittenPractice.Subject.Answer) -> String? {
    guard let criteria = answer.criteria, answer.range == nil else { return nil }

    return String(
      localized: "\(String(criteria.complete)) of \(String(criteria.total)) criteria complete",
      table: "Plan",
      comment:
        "A past written answer graded by level: how many of its criteria were fully met, out of all of them."
    )
  }

  private func facts(_ answer: GoalPlan.WrittenPractice.Subject.Answer) -> [String] {
    [
      answer.unit == .drill ? WritingLabels.taskTitle(unit: .drill, task: nil, fallback: nil) : nil,
      lineFact(answer),
      answer.versions > 1
        ? String(
          localized: "\(answer.versions) versions", table: "Plan",
          comment: "How many times an answer was written")
        : nil,
      PlanDate.text(answer.date, today: PlanDate.today()),
    ].compactMap(\.self)
  }

}
