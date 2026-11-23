import SwiftUI

/// A graded written answer: with a scale, the range, its parts and the passage to rewrite; without
/// one, no total, the one change that helps most and a level per criterion. Then the text as sent,
/// its errors marked and listed (main's `WritingResultView`).
struct WritingResultSections: View {
  let grade: WritingResult
  let prompt: WritingPrompt
  let text: String

  var body: some View {
    if let points = grade.points {
      WritingPointsSection(
        points: points, errors: grade.errors.count, lines: grade.estimatedLines, prompt: prompt,
        text: text)
    }

    WritingProgressSection(grade: grade)
    WritingNextStepSection(step: WritingNextStep(grade: grade, text: text), lines: prompt.lines)
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
          PointsReadout(range: points.total, max: points.max, decimals: points.decimals)
          Text("Estimated score", tableName: "Essay")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
        .accessibilityElement(children: .combine)

        VStack(alignment: .leading, spacing: 6) {
          let part = prompt.partMinimum
          let sameScale = part?.max == points.max
          RangeBar(
            range: points.total, max: points.max,
            minimum: sameScale ? part?.share.map { $0 * points.max } : nil)

          if let part, let share = part.share {
            if let max = part.max, !sameScale {
              let minimum = WritingLabels.points(
                part.minimum.unit == .points ? part.minimum.value : share * max)
              Text(
                "Minimum to pass the written test: \(minimum) of \(WritingLabels.points(max)) points in total",
                tableName: "Essay"
              )
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
            } else {
              let label = Text(
                "Minimum to pass the written test: \(WritingLabels.share(share)) of the points",
                tableName: "Essay")
              if sameScale {
                MinimumLegend(label)
              } else {
                label.typeStyle(.note).foregroundStyle(.mutedForeground)
              }
            }
          }
        }
      }
      .padding(.vertical, 4)

      if let zeroReason = points.zeroReason {
        Text(zeroReason)
      } else {
        LabeledContent {
          Text(verbatim: WritingLabels.range(points.content, decimals: points.decimals))
            .typeStyle(.data)
            .foregroundStyle(Color(.foreground))
        } label: {
          Text("Content", tableName: "Essay")
        }

        LabeledContent {
          Text(verbatim: WritingLabels.deduction(points.deduction))
            .typeStyle(.data)
            .foregroundStyle(Color(.foreground))
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Text("Language errors", tableName: "Essay")
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
      localized: "about \(lines) of \(limit) lines", table: "Essay")
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
    // A zeroed answer's one step is the rule it broke, not a criterion still short.
    let isZeroed = grade.points?.zeroReason != nil || grade.nextStep?.kind == .zero

    if !isZeroed, !fixed.isEmpty || !persists.isEmpty {
      Section {
        if !fixed.isEmpty {
          Text(
            "Fixed: \(names(fixed))", tableName: "Essay"
          )
          .foregroundStyle(.successText)
        }
        if !persists.isEmpty {
          Text(
            "Still to work on: \(names(persists))", tableName: "Essay"
          )
          .foregroundStyle(.mutedForeground)
        }
      } header: {
        SectionTitle(
          Text("Since your last version", tableName: "Essay"))
      }
    }
  }
}

/// The one thing to work on: the same card for every rubric's result. With nothing left, the
/// card says so, with no chip, since there's no step.
private struct WritingNextStepSection: View {
  let step: WritingNextStep
  let lines: Int?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 10) {
        switch step {
        case .done:
          Text("Nothing left to work on", tableName: "Essay", comment: "Full marks")
            .typeStyle(.stepHeading)
          Text("Every criterion is complete.", tableName: "Essay")
            .typeStyle(.body)
            .foregroundStyle(.mutedForeground)
        case .limit:
          card(title: limitTitle, text: limitText)
        case .short:
          card(
            title: String(localized: "Write a longer answer", table: "Essay"),
            text: String(
              localized: "This answer is too short to grade. Add more and send it again.",
              table: "Essay"))
        case .zero(let text, let zeroKind):
          let copy = zeroKind.map(Self.zeroCopy)
          card(
            title: copy?.title
              ?? String(localized: "Answer the question asked", table: "Essay"),
            text: copy?.text
              ?? (text.isEmpty
                ? String(localized: "Rewrite it following the rule above.", table: "Essay") : text))
        case .criterion(let title, let text, let quote, let example):
          card(
            title: title
              ?? String(
                localized: "What to rewrite", table: "Essay"),
            text: text, quote: quote, example: example)
        }
      }
      .padding(.vertical, 4)
    }
  }

  @ViewBuilder
  private func card(title: String, text: String, quote: String? = nil, example: String? = nil)
    -> some View
  {
    Chip(Text("Next step", tableName: "Essay", comment: "The one thing to work on next"))

    Text(title)
      .typeStyle(.stepHeading)

    if let quote {
      QuotedPassage(quote, accent: .warning)
    }

    Text(text)
      .typeStyle(.reading)

    if let example {
      Text("For example: \(example)", tableName: "Essay", comment: "A rewrite example")
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
    }
  }

  private var limitTitle: String {
    lines.map { String(localized: "Fit it in \(String($0)) lines", table: "Essay") }
      ?? String(localized: "Fit it in the line limit", table: "Essay")
  }

  private var limitText: String {
    lines.map {
      String(
        localized: "Graders stop at line \(String($0)), so the rest isn't read.", table: "Essay")
    }
      ?? String(
        localized: "Graders stop at the line limit, so the rest isn't read.", table: "Essay")
  }

  /// A zeroed answer's step, by the rule it broke. The notice's rule shows above it, so this says
  /// what to do, never why it scored zero.
  private static func zeroCopy(_ kind: WritingResult.ZeroKind) -> (title: String, text: String) {
    switch kind {
    case .blank:
      (
        String(localized: "Write an answer", table: "Essay"),
        String(localized: "Start with the points the question asks for.", table: "Essay")
      )
    case .offTopic:
      (
        String(localized: "Answer the question asked", table: "Essay"),
        String(localized: "Reread the question and write about what it asks.", table: "Essay")
      )
    case .wrongForm:
      (
        String(
          localized: "Write it in the form asked", table: "Essay",
          comment:
            "The next step of a written answer zeroed for being in the wrong form, such as a list where an essay was asked."
        ),
        String(
          localized: "Check what kind of text the question asks for, and write that.",
          table: "Essay")
      )
    case .tooFewLines:
      (
        String(
          localized: "Reach the minimum length", table: "Essay",
          comment:
            "The next step of a written answer zeroed for being shorter than the exam's minimum number of lines."
        ),
        String(
          localized: "Develop each point the question asks for until you reach it.",
          table: "Essay")
      )
    case .copiedSupport:
      (
        String(localized: "Use your own words", table: "Essay"),
        String(
          localized: "Take the support text as a starting point, not as your answer.",
          table: "Essay")
      )
    case .identification:
      (
        String(localized: "Leave out anything that identifies you", table: "Essay"),
        String(
          localized: "Remove names, signatures and marks that aren't part of the answer.",
          table: "Essay")
      )
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

      Button {
        showsComments = true
      } label: {
        Text("See comments", tableName: "Essay")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
      .sheet(isPresented: $showsComments) {
        NavigationStack {
          ZoonkList {
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
          }
          .navigationTitle(
            String(localized: "Comments", table: "Essay", comment: "The criteria comments sheet")
          )
          .navigationBarTitleDisplayMode(.inline)
          .sheetClose { showsComments = false }
        }
        .presentationDetents([.medium, .large])
        .zoonkSheet()
      }
    } header: {
      SectionTitle(Text("Criteria", tableName: "Essay"))
    } footer: {
      if let source {
        SectionFooter { Text(source) }
      }
    }
  }

  /// The name wraps; the meter and its value end every row at one place, the value as wide as the
  /// widest, so the meters line up (main's `WritingCriteria`).
  private func row(_ criterion: WritingResult.Criterion) -> some View {
    let points = grade.points?.rows.first { $0.id == criterion.id }

    return AccessibilityStack(alignment: .center, spacing: 12, stackedSpacing: 6) {
      Text(criterion.name)
        .frame(maxWidth: .infinity, alignment: .leading)

      HStack(spacing: 10) {
        if let points {
          RowMeter(
            range: points.range ?? .init(high: points.earned, low: points.earned), max: points.max
          )
          .frame(width: 64)
          valueColumn(score(points), widest: grade.points?.rows.map(score) ?? [])
            .typeStyle(.data)
        } else {
          LevelCells(level: criterion.level)
          valueColumn(
            WritingLabels.level(criterion.level),
            widest: [.complete, .strong, .partial, .missing].map(WritingLabels.level)
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      }
      .fixedSize()
    }
    .accessibilityElement(children: .combine)
  }

  /// One value, trailing in a column as wide as the widest of its kind.
  private func valueColumn(_ value: String, widest: [String]) -> some View {
    ZStack(alignment: .trailing) {
      ForEach(Array(Set(widest)), id: \.self) { Text($0).hidden().accessibilityHidden(true) }
      Text(value)
    }
  }

  private func score(_ row: WritingResult.Row) -> String {
    String(
      localized:
        "\(WritingLabels.range(row.range ?? .init(high: row.earned, low: row.earned), decimals: decimals(row))) of \(WritingLabels.points(row.max, decimals: decimals(row)))",
      table: "Essay", comment: "A criterion's points, like '7.1 of 9.5'")
  }

  private func decimals(_ row: WritingResult.Row) -> Int? {
    row.decimals ?? grade.points?.decimals
  }

  private var source: String? {
    if grade.points == nil, prompt.criteria.allSatisfy({ $0.points == nil }) {
      return String(
        localized: "The exam notice doesn't say how many points each criterion is worth.",
        table: "Essay")
    }

    guard grade.points != nil else { return nil }

    return prompt.keySource == .notice
      ? String(
        localized: "Criteria and points from the exam notice.", table: "Essay")
      : String(
        localized:
          "Criteria and points from the exam notice. The answer key is ours, for practice.",
        table: "Essay")
  }
}

/// A criterion's points in ink: what's surely earned, then what may be, then the rest.
private struct RowMeter: View {
  let range: WritingRange
  let max: Double

  var body: some View {
    let low = Swift.max(0, Swift.min(1, range.low / max))
    let high = Swift.max(low, Swift.min(1, range.high / max))

    MeterParts(
      parts: [
        low > 0 ? .init(weight: low, fill: .color(Color(.foreground))) : nil,
        high > low ? .init(weight: high - low, fill: .color(Color(.foreground).opacity(0.3))) : nil,
        high < 1 ? .init(weight: 1 - high, fill: .track) : nil,
      ].compactMap { $0 }
    )
    .accessibilityHidden(true)
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
