import SwiftUI

/// A written part's page: where the learner stands in points, how the answers move, and each answer
/// (main's `SubjectWrittenScore`).
struct SubjectWrittenSections: View {
  let written: GoalPlan.WrittenPractice.Subject

  var body: some View {
    SubjectWrittenPoints(points: written.points)
    SubjectWrittenTrend(samples: Array(written.trend.suffix(4)))
    SubjectWrittenAnswers(answers: written.answers)
  }
}

/// The part's estimated points, its own minimum, and each question's share of them.
private struct SubjectWrittenPoints: View {
  let points: WrittenPartPoints

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text("Estimated score", tableName: "Plan", comment: "A written part's projected points")
          .typeStyle(.label)
          .foregroundStyle(.mutedForeground)

        if let range = points.range, let max = points.max {
          PointsReadout(range: range, max: max)
        } else {
          Text("Not measured yet", tableName: "Plan", comment: "A part with no graded answer yet")
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
          MinimumLegend(minimumText(minimum))
        }
      }
      .padding(.vertical, 4)

      ForEach(points.tasks) { task in
        LabeledContent {
          if let range = task.range, let max = task.max {
            Text(verbatim: WritingLabels.range(range, of: max))
              .typeStyle(.data)
          } else {
            Text("Not measured yet", tableName: "Plan", comment: "A part with no graded answer yet")
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        } label: {
          Text(task.name)
        }
      }
    }
  }
}

/// Where a minimum falls on a scale, as a share of it.
private func minimumShare(_ minimum: PointsMinimum, max: Double) -> Double? {
  minimum.unit == .percent ? minimum.value / 100 : max > 0 ? minimum.value / max : nil
}

private func minimumText(_ minimum: PointsMinimum) -> Text {
  minimum.unit == .percent
    ? Text(
      "Minimum to pass: \((minimum.value / 100).formatted(.percent.precision(.fractionLength(0)))) of the points",
      tableName: "Plan", comment: "A written part's own minimum, as a share of its points")
    : Text(
      "Minimum to pass: \(WritingLabels.points(minimum.value))", tableName: "Plan",
      comment: "A written part's own minimum")
}

/// One small bar per answer, oldest first, the latest in full color.
private struct SubjectWrittenTrend: View {
  let samples: [GoalPlan.WrittenPractice.Subject.Sample]

  var body: some View {
    if let latest = samples.last {
      Section {
        row(
          Text("Content", tableName: "Essay", comment: "A written answer's content points"),
          values: samples.map(\.contentShare), last: share(latest.contentShare))
        row(
          Text(
            "Presentation and structure", tableName: "Plan",
            comment: "How a written answer is laid out"),
          values: samples.map(\.presentationShare), last: share(latest.presentationShare))
        row(
          Text("Language errors", tableName: "Essay", comment: "Points taken off for language"),
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
    value.map { $0.formatted(.percent.precision(.fractionLength(0))) } ?? ""
  }

  @ViewBuilder
  private func row(_ label: Text, values: [Double?], last: String) -> some View {
    if values.contains(where: { $0 != nil }) {
      LabeledContent {
        HStack(spacing: 12) {
          TrendBars(values: values)
          Text(verbatim: last)
            .typeStyle(.data)
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
            ListRow(Text(answer.title), descriptionFacts: facts(answer)) {
              EmptyView()
            } trailing: {
              if let range = answer.range {
                Text(verbatim: WritingLabels.range(range))
                  .typeStyle(.data)
              }
            }
            .disclosureChevron()
          }
        }
      } header: {
        SectionTitle(Text("Your answers", tableName: "Plan", comment: "Past written answers")) {
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
        localized: "about \(used) of \(limit) lines", table: "Essay",
        comment: "An answer's estimated handwritten lines, of the question's limit")
    }
  }

  private func facts(_ answer: GoalPlan.WrittenPractice.Subject.Answer) -> [String] {
    [
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
