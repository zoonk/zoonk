import SwiftUI

/// A graded written answer: with a scale, the range, its parts and the passage to rewrite; without
/// one, no total, the one change that helps most and a level per criterion. Then the text as sent,
/// its errors marked and listed (main's `WritingResultView`).
struct WritingResultSections: View {
  let grade: WritingResult
  let prompt: WritingPrompt
  let text: String
  /// Which answer this is, where a result shows several (a written test).
  var eyebrow: String?

  var body: some View {
    if let points = grade.points {
      WritingPointsSection(
        points: points, errors: grade.errors.count, lines: grade.estimatedLines, prompt: prompt,
        text: text)
    }

    WritingProgressSection(grade: grade)
    WritingNextStepSection(grade: grade, chip: eyebrow)
    WritingCriteriaSection(grade: grade, prompt: prompt)
    WritingMarkedTextSection(grade: grade, lines: prompt.lines, text: text)
  }
}

/// The total as a range on the question's scale, then what it's made of, so the parts never
/// contradict it.
private struct WritingPointsSection: View {
  let points: WritingResult.Points
  let errors: Int
  /// The server's count; older results leave it to this device.
  let lines: Int?
  let prompt: WritingPrompt
  let text: String

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        Chip(Text("Your answer", tableName: "Essay", comment: "Over a written answer's score"))

        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .lastTextBaseline, spacing: 6) {
            Text(verbatim: WritingLabels.range(points.total))
              .typeStyle(.momentReadout)
              .monospacedDigit()
            Text(
              "of \(WritingLabels.points(points.max))", tableName: "Essay",
              comment: "After a score: the question's total, like 'of 30'"
            )
            .typeStyle(.body)
            .foregroundStyle(.mutedForeground)
          }
          Text("Estimated score", tableName: "Essay", comment: "Under a written answer's range")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
        .accessibilityElement(children: .combine)

        // The written test's minimum is on the sum of its questions: its tick sits at the same
        // share of this question's points and says it's the test's, never this question's.
        if let share = prompt.partMinimum?.share {
          VStack(alignment: .leading, spacing: 6) {
            RangeBar(range: points.total, max: points.max, minimum: share * points.max)
            MinimumLegend(
              Text(
                "Minimum to pass the written test: \(share.formatted(.percent.precision(.fractionLength(0)))) of the points",
                tableName: "Essay",
                comment:
                  "Under a question's score: the written test's own minimum, on the sum of its questions"
              ))
          }
        } else {
          RangeBar(range: points.total, max: points.max)
        }
      }
      .padding(.vertical, 4)

      if let zeroReason = points.zeroReason {
        Text(zeroReason)
      } else {
        LabeledContent {
          Text(verbatim: WritingLabels.range(points.content))
            .typeStyle(.data)
        } label: {
          Text("Content", tableName: "Essay", comment: "A written answer's content points")
        }

        LabeledContent {
          Text(verbatim: WritingLabels.deduction(points.deduction))
          .typeStyle(.data)
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Text("Language errors", tableName: "Essay", comment: "Points taken off for language")
            FactSegments([errorCount, lineCount])
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
      }
    }
  }

  private var errorCount: String { WritingLabels.errors(errors) }

  /// The lines sent, against the question's limit when it has one.
  private var lineCount: String {
    let lines =
      self.lines
      ?? WritingLines.count(
        text, charactersPerLine: prompt.charactersPerLine, limit: prompt.lines
      ).estimatedLines

    guard let limit = prompt.lines else {
      return String(
        localized: "about \(lines) lines", table: "Essay",
        comment: "An answer's estimated handwritten lines")
    }

    return String(
      localized: "about \(lines) of \(limit) lines", table: "Essay",
      comment: "An answer's estimated handwritten lines, of the question's limit")
  }

}

/// A range of points on its scale: what's surely earned, then what may be, then the rest.
struct RangeBar: View {
  let range: WritingRange
  let max: Double
  var minimum: Double?

  var body: some View {
    let low = Swift.max(0, Swift.min(1, range.low / max))
    let high = Swift.max(low, Swift.min(1, range.high / max))

    MeterParts(
      parts: [
        low > 0 ? .init(weight: low, fill: .color(.success)) : nil,
        high > low ? .init(weight: high - low, fill: .color(.success.opacity(0.4))) : nil,
        high < 1 ? .init(weight: 1 - high, fill: .track) : nil,
      ].compactMap { $0 }
    )
    .overlay(alignment: .leading) {
      if let minimum {
        GeometryReader { proxy in
          Capsule()
            .fill(Color(.foreground))
            .frame(width: 2, height: 14)
            .position(x: proxy.size.width * Swift.min(1, minimum / max), y: proxy.size.height / 2)
        }
      }
    }
    .accessibilityHidden(true)
  }
}

/// What a rewrite changed, by criterion: only after a second version.
private struct WritingProgressSection: View {
  let grade: WritingResult

  private func names(_ ids: [String]) -> String {
    ids.map { id in grade.criteria.first { $0.id == id }?.name ?? id }
      .formatted(.list(type: .and))
  }

  var body: some View {
    let fixed = grade.progress?.fixed ?? []
    let persists = grade.progress?.persists ?? []

    if !fixed.isEmpty || !persists.isEmpty {
      Section {
        if !fixed.isEmpty {
          Text(
            "Fixed: \(names(fixed))", tableName: "Essay",
            comment: "Criteria a rewrite fixed since the last version"
          )
          .foregroundStyle(.successText)
        }
        if !persists.isEmpty {
          Text(
            "Still to work on: \(names(persists))", tableName: "Essay",
            comment: "Criteria still to fix after a rewrite"
          )
          .foregroundStyle(.mutedForeground)
        }
      } header: {
        SectionTitle(
          Text("Since your last version", tableName: "Essay", comment: "What a rewrite changed"))
      }
    }
  }
}

/// The one thing to work on: the same card for every rubric's result.
private struct WritingNextStepSection: View {
  let grade: WritingResult
  let chip: String?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 10) {
        if let chip {
          Chip(Text(chip))
        }

        Chip(Text("Next step", tableName: "Essay", comment: "The one thing to work on next"))

        if let next = grade.nextStep {
          Text(
            grade.nextStepCriterion?.name
              ?? String(
                localized: "What to rewrite", table: "Essay", comment: "A next step's title")
          )
          .typeStyle(.stepHeading)

          if let quote = next.quote {
            QuotedPassage(quote, accent: .warning)
          }

          Text(next.text)
            .typeStyle(.reading)

          if let example = next.example {
            Text("For example: \(example)", tableName: "Essay", comment: "A rewrite example")
              .typeStyle(.body)
              .foregroundStyle(.mutedForeground)
          }
        } else {
          Text("Nothing left to work on", tableName: "Essay", comment: "Full marks")
            .typeStyle(.stepHeading)
          Text(
            "Every criterion has full marks in this estimate.", tableName: "Essay",
            comment: "Full marks on every criterion"
          )
          .foregroundStyle(.mutedForeground)
        }
      }
      .padding(.vertical, 4)
    }
  }
}

/// A passage of the learner's text, set off by a bar in its color.
struct QuotedPassage: View {
  let text: String
  let accent: Color
  var isItalic = true

  init(_ text: String, accent: Color = .border, isItalic: Bool = true) {
    self.text = text
    self.accent = accent
    self.isItalic = isItalic
  }

  var body: some View {
    Text(text)
      .italic(isItalic)
      .typeStyle(.body)
      .padding(.leading, 12)
      .overlay(alignment: .leading) {
        Rectangle().fill(accent).frame(width: 2)
      }
  }
}

private struct WritingCriteriaSection: View {
  let grade: WritingResult
  let prompt: WritingPrompt
  @State private var showsComments = false

  var body: some View {
    Section {
      ForEach(grade.criteria) { criterion in
        row(criterion)
      }

      DisclosureGroup(isExpanded: $showsComments) {
        ForEach(grade.criteria) { criterion in
          VStack(alignment: .leading, spacing: 6) {
            Text(criterion.name)
              .typeStyle(.rowTitle)
            if let quote = criterion.quote {
              QuotedPassage(quote)
                .foregroundStyle(.mutedForeground)
            }
            Text(criterion.comment)
              .typeStyle(.reading)
          }
        }
      } label: {
        Text("See comments", tableName: "Essay", comment: "Opens the comment on each criterion")
      }
    } header: {
      SectionTitle(Text("Criteria", tableName: "Essay", comment: "A written answer's criteria"))
    } footer: {
      if let source {
        SectionFooter { Text(source) }
      }
    }
  }

  private func row(_ criterion: WritingResult.Criterion) -> some View {
    let points = grade.points?.rows.first { $0.id == criterion.id }

    return LabeledContent {
      HStack(spacing: 10) {
        if let points {
          Meter(value: points.earned, total: points.max)
            .frame(width: 64)
          Text(
            "\(WritingLabels.points(points.earned)) of \(WritingLabels.points(points.max))",
            tableName: "Essay", comment: "A criterion's points, like '7.1 of 9.5'"
          )
          .typeStyle(.data)
        } else {
          LevelCells(level: criterion.level)
          Text(WritingLabels.level(criterion.level))
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
    } label: {
      Text(criterion.name)
    }
  }

  private var source: String? {
    if grade.points == nil, prompt.criteria.allSatisfy({ $0.points == nil }) {
      return String(
        localized: "The exam notice doesn't say how many points each criterion is worth.",
        table: "Essay", comment: "Under criteria graded by level")
    }

    guard grade.points != nil else { return nil }

    return prompt.keySource == .notice
      ? String(
        localized: "Criteria and points from the exam notice.", table: "Essay",
        comment: "Where a result's criteria come from")
      : String(
        localized:
          "Criteria and points from the exam notice. The answer key is ours, for practice.",
        table: "Essay", comment: "Where a result's criteria come from, with Zoonk's practice key")
  }
}

/// Four cells, filled by how fully a criterion is met.
private struct LevelCells: View {
  let level: WritingResult.Level

  var body: some View {
    HStack(spacing: 2) {
      ForEach(0..<4, id: \.self) { index in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(index < WritingLabels.cells(level) ? Color.success : Color.surface3)
          .frame(width: 8, height: 8)
      }
    }
    .accessibilityHidden(true)
  }
}

/// The tick's legend under a meter, marked as the tick is.
struct MinimumLegend: View {
  let text: Text

  init(_ text: Text) {
    self.text = text
  }

  @ScaledMetric(relativeTo: .footnote) private var tick = 14.0

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Capsule()
        .fill(Color(.foreground))
        .frame(width: 2, height: tick)
        .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
        .accessibilityHidden(true)
      text
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }
}

/// A meter's place while nothing is measured yet: a dashed outline.
struct UnmeasuredBar: View {
  var body: some View {
    RoundedRectangle(cornerRadius: 3, style: .continuous)
      .strokeBorder(.border, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
      .frame(height: 6)
      .accessibilityHidden(true)
  }
}
