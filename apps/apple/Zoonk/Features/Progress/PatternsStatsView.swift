import SwiftUI

/// A group of answers the patterns compare: a day of the week or a part of the day.
protocol ScorePatternGroup: Equatable {
  var performance: ScorePerformance { get }
}

extension WeekdayScorePattern: ScorePatternGroup {}
extension DaypartScorePattern: ScorePatternGroup {}

/// What the patterns can honestly say about one side of them (the week's days, the day's parts):
/// which group is the best, that they're about even (within `points` of each other), or that fewer
/// than two groups have enough answers to compare yet.
enum PatternVerdict<Pattern: ScorePatternGroup>: Equatable {
  case best(Pattern)
  case even(points: Int)
  case notEnough

  /// The answers a group needs to count, as core applies it: one lucky answer never makes a pattern.
  static var minimumAnswers: Int { 10 }

  /// Under this many points between the best and the worst group that counts, none stands out.
  private static var evenSpread: Double { 5 }

  /// Names a best group only when it stands out from others that count: a lone group has nothing
  /// to be better than, and a lead of a few points is noise. `strongest` is core's, which already
  /// leaves out groups with too few answers.
  init(groups: [Pattern], strongest: Pattern?) {
    let scores = Self.counted(groups).map(\.performance.score)

    guard let strongest, scores.count >= 2, let high = scores.max(), let low = scores.min() else {
      self = .notEnough
      return
    }

    self =
      high - low < Self.evenSpread
      ? .even(points: Int((high - low).rounded(.up))) : .best(strongest)
  }

  static func counted(_ groups: [Pattern]) -> [Pattern] {
    groups.filter { $0.performance.totalAnswers >= minimumAnswers }
  }

  var best: Pattern? {
    if case .best(let group) = self {
      return group
    }

    return nil
  }
}

extension ScorePatterns {
  var dayVerdict: PatternVerdict<WeekdayScorePattern> {
    PatternVerdict(groups: weekdays, strongest: strongestWeekday)
  }

  var timeVerdict: PatternVerdict<DaypartScorePattern> {
    PatternVerdict(groups: dayparts, strongest: strongestDaypart)
  }

  /// The best day's name, "Any day" when they're even, or nil before one can count.
  var bestDayName: String? {
    switch dayVerdict {
    case .best(let day):
      day.weekday.localizedTitle()
    case .even:
      String(
        localized: "Any day", table: "Progress",
        comment: "Best day when every day scores about the same")
    case .notEnough:
      nil
    }
  }

  /// The best part of the day's name, "Any time" when they're even, or nil before one can count.
  var bestTimeName: String? {
    switch timeVerdict {
    case .best(let time):
      String(localized: time.daypart.localizedTitle)
    case .even:
      String(
        localized: "Any time", table: "Progress",
        comment: "Best time when every part of the day scores about the same")
    case .notEnough:
      nil
    }
  }

  /// The range the counted days span in whole percents ("69–73%"), with two or more of them.
  var weekSpread: String? {
    let scores = PatternVerdict<WeekdayScorePattern>.counted(weekdays).map(\.performance.score)

    guard scores.count >= 2, let low = scores.min(), let high = scores.max() else {
      return nil
    }

    return "\(wholePercent(low))–\(wholePercent(high))"
  }
}

/// Patterns: the best day and time on tiles, every day of the week and part of the day as rows on
/// one scale (side by side on a wide screen), and the honest lines under them.
struct PatternsStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.patterns.state, retry: { await progress.patterns.refresh() }) {
      patterns in
      PatternTiles(patterns: patterns)

      StatsColumns(minimumWidth: 760) {
        WeekPatterns(patterns: patterns)
          .frame(maxWidth: .infinity, alignment: .topLeading)
        DayPatterns(patterns: patterns)
          .frame(maxWidth: .infinity, alignment: .topLeading)
      }

      PatternsNote(patterns: patterns)
    }
    .loads(progress.patterns)
  }
}

private struct PatternTiles: View {
  let patterns: ScorePatterns
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [3, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(
          "Best day", tableName: "Progress", comment: "The day of the week the learner answers best"
        ),
        value: Text(verbatim: patterns.bestDayName ?? "–"),
        systemImage: "calendar", tone: .success,
        detail: verdictDetail(patterns.dayVerdict)
      )

      StatTile(
        label: Text(
          "Best time", tableName: "Progress",
          comment: "The part of the day the learner answers best"),
        value: Text(verbatim: patterns.bestTimeName ?? "–"),
        systemImage: "clock", tone: .success,
        detail: verdictDetail(patterns.timeVerdict)
      )

      StatTile(
        label: Text(
          "Answers", tableName: "Progress", comment: "Tile: how many answers the patterns come from"
        ),
        value: Text(
          patterns.weekdays.reduce(0) { $0 + $1.performance.totalAnswers }, format: .number),
        systemImage: "checklist",
        detail: Text(
          "In the last 90 days", tableName: "Progress",
          comment: "Under the answers count: their window")
      )
    }
  }
}

/// Under a best day's or time's name: its share and answers, how close they all are, or why not yet.
private func verdictDetail<Pattern: ScorePatternGroup>(_ verdict: PatternVerdict<Pattern>) -> Text {
  switch verdict {
  case .best(let group):
    Text(
      "\(wholePercent(group.performance.score)) · \(group.performance.totalAnswers) answers",
      tableName: "Progress",
      comment: "Under the best day or time: its share of right answers and its answers")
  case .even(let points) where points == 0:
    Text(
      "Within 0 points", tableName: "Progress",
      comment: "Under Any day or Any time: they all score the same")
  case .even(let points):
    Text(
      "Within \(points) points", tableName: "Progress",
      comment: "Under Any day or Any time: how close the days or times score")
  case .notEnough:
    Text(
      "Not enough answers yet", tableName: "Progress",
      comment: "Under a best day or time that can't be named yet")
  }
}

/// One day or part of the day as a row: its name (a part of the day with its hours beside it) over
/// its answers, its share of right answers as a bar on a 0–100 scale, and the share. A group with
/// too few answers to count stays gray, so a lucky answer never reads as a result.
private struct PatternRow: View {
  let name: String
  var hours: String?
  let performance: ScorePerformance
  let isBest: Bool

  @Environment(\.dynamicTypeSize) private var typeSize
  @ScaledMetric(relativeTo: .subheadline) private var nameWidth = 130.0
  @ScaledMetric(relativeTo: .subheadline) private var shareWidth = 44.0

  private var isCounted: Bool {
    performance.totalAnswers >= PatternVerdict<WeekdayScorePattern>.minimumAnswers
  }

  var body: some View {
    Group {
      // At the accessibility sizes the bar and share go under the name instead of squeezing it.
      if typeSize.isAccessibilitySize {
        VStack(alignment: .leading, spacing: 6) {
          label
          HStack(spacing: 12) {
            bar
            share
          }
        }
      } else {
        HStack(spacing: 16) {
          label
            .frame(width: nameWidth, alignment: .leading)
          bar
          share
            .frame(width: shareWidth, alignment: .trailing)
        }
      }
    }
    .padding(.vertical, 10)
    .accessibilityElement(children: .combine)
  }

  private var label: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text(name)
          .font(.subheadline.weight(isBest ? .semibold : .regular))
          .lineLimit(typeSize.isAccessibilitySize ? nil : 1)

        if let hours {
          Text(hours)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
            .fixedSize()
        }
      }

      Text(answers)
        .font(.caption.monospacedDigit())
        .foregroundStyle(.secondary)
    }
  }

  private var bar: some View {
    Gauge(value: min(max(performance.score, 0), 100), in: 0...100) {
      EmptyView()
    }
    .gaugeStyle(.linearCapacity)
    .tint(barColor)
    .opacity(performance.totalAnswers > 0 ? 1 : 0)
    .accessibilityHidden(true)
  }

  private var share: some View {
    Text(performance.totalAnswers > 0 ? wholePercent(performance.score) : "–")
      .font(.subheadline.monospacedDigit())
      .foregroundStyle(isCounted ? Color.primary : Color.secondary)
  }

  private var answers: String {
    performance.totalAnswers == 0
      ? String(
        localized: "No answers", table: "Progress",
        comment: "A day or part of the day without answers")
      : String(
        localized: "\(performance.totalAnswers) answers", table: "Progress",
        comment: "A count of answers")
  }

  private var barColor: Color {
    guard isCounted else {
      return Color.primary.opacity(0.2)
    }

    return isBest ? .success : Color.success.opacity(0.45)
  }
}

/// Every day of the week as a row, Sunday first, the best one (when one stands out) in blue.
private struct WeekPatterns: View {
  let patterns: ScorePatterns

  var body: some View {
    StatsBlock(
      title: Text(
        "Throughout the week", tableName: "Progress",
        comment: "Title of the rows per day of the week")
    ) {
      VStack(spacing: 0) {
        ForEach(patterns.weekdays) { day in
          PatternRow(
            name: day.weekday.localizedTitle(), performance: day.performance,
            isBest: day.weekday == patterns.dayVerdict.best?.weekday)

          if day.id != patterns.weekdays.last?.id {
            Divider()
          }
        }
      }
      .padding(.horizontal)
      .background(
        Color(.secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
  }
}

/// The four parts of the day as rows with their hours, the best one (when one stands out) in blue.
private struct DayPatterns: View {
  let patterns: ScorePatterns

  var body: some View {
    StatsBlock(
      title: Text(
        "Throughout the day", tableName: "Progress",
        comment: "Title of the rows per part of the day")
    ) {
      VStack(spacing: 0) {
        ForEach(patterns.dayparts) { time in
          PatternRow(
            name: String(localized: time.daypart.localizedTitle),
            hours: time.daypart.localizedTimeRange(),
            performance: time.performance,
            isBest: time.daypart == patterns.timeVerdict.best?.daypart)

          if time.id != patterns.dayparts.last?.id {
            Divider()
          }
        }
      }
      .padding(.horizontal)
      .background(
        Color(.secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
  }
}

/// The honest lines under the patterns: that the days (or the parts of the day) are too close to
/// name a best, and how many answers a group needs to count.
struct PatternsNote: View {
  let patterns: ScorePatterns

  var body: some View {
    Text(sentences.joined(separator: " "))
      .font(.footnote)
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var sentences: [String] {
    var sentences: [String] = []

    if case .even(let points) = patterns.dayVerdict {
      sentences.append(
        points == 0
          ? String(
            localized: "Your days are within 0 points of each other, so any day works.",
            table: "Progress",
            comment: "Patterns note when every day scores the same")
          : String(
            localized: "Your days are within \(points) points of each other, so any day works.",
            table: "Progress",
            comment: "Patterns note when the days score about the same"))
    }

    if case .even(let points) = patterns.timeVerdict {
      sentences.append(
        points == 0
          ? String(
            localized: "Your times of day are within 0 points of each other, so any time works.",
            table: "Progress", comment: "Patterns note when every part of the day scores the same")
          : String(
            localized:
              "Your times of day are within \(points) points of each other, so any time works.",
            table: "Progress",
            comment: "Patterns note when the parts of the day score about the same"))
    }

    sentences.append(
      String(
        localized:
          "A day or a time of day needs \(PatternVerdict<WeekdayScorePattern>.minimumAnswers) answers to count, so one lucky answer never makes a pattern.",
        table: "Progress", comment: "Patterns note: how many answers a day or time needs to count"))

    return sentences
  }
}
