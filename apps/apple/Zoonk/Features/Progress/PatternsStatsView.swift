import SwiftUI

protocol ScorePatternGroup: Equatable {
  var performance: ScorePerformance { get }
}

extension WeekdayScorePattern: ScorePatternGroup {}
extension DaypartScorePattern: ScorePatternGroup {}

extension ScorePatterns {
  var bestDayName: String? {
    switch dayVerdict {
    case .best(let day):
      day.weekday.localizedTitle()
    case .even:
      String(
        localized: "Any day", table: "Progress",
        comment: "Best day to study when every day scores about the same: any day works")
    case .notEnough:
      nil
    }
  }

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

  /// Main's one sentence over the charts: the best day, then the best time.
  var summary: String {
    let day: String? =
      switch dayVerdict {
      case .best(let best):
        String(
          localized: "Your best day is \(best.weekday.localizedTitle()).", table: "Progress",
          comment: "Over the patterns charts; the argument is a weekday's full name")
      case .even:
        String(
          localized: "You answer about the same every day.", table: "Progress",
          comment: "Over the patterns charts, when every day scores about the same")
      case .notEnough:
        nil
      }

    let time: String? =
      switch timeVerdict {
      case .best(let best):
        best.daypart.bestTimeSentence
      case .even:
        String(
          localized: "The time of day makes no difference.", table: "Progress",
          comment: "Over the patterns charts, when every part of the day scores about the same")
      case .notEnough:
        nil
      }

    let parts = [day, time].compactMap(\.self)

    return parts.isEmpty
      ? String(
        localized: "Answer more questions to see when you do best.", table: "Progress",
        comment: "Over the patterns charts, before there are enough answers")
      : parts.joined(separator: " ")
  }
}

extension ProgressDaypart {
  /// One sentence each, so every language words its part of the day as it needs.
  fileprivate var bestTimeSentence: String {
    switch self {
    case .morning:
      String(
        localized: "Your best time is the morning.", table: "Progress",
        comment: "Over the patterns charts: the part of the day the learner answers best")
    case .afternoon:
      String(
        localized: "Your best time is the afternoon.", table: "Progress",
        comment: "Over the patterns charts: the part of the day the learner answers best")
    case .evening:
      String(
        localized: "Your best time is the evening.", table: "Progress",
        comment: "Over the patterns charts: the part of the day the learner answers best")
    case .night:
      String(
        localized: "Your best time is the night.", table: "Progress",
        comment: "Over the patterns charts: the part of the day the learner answers best")
    }
  }
}

struct PatternsStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.patterns.state, retry: { await progress.patterns.refresh() }) {
      patterns in
      Text(patterns.summary)
        .typeStyle(.section.weight(.medium))
        .foregroundStyle(Color(.foreground))
        .frame(maxWidth: .infinity, alignment: .leading)

      StatsColumns(minimumWidth: 760) {
        WeekPatterns(patterns: patterns)
          .frame(maxWidth: .infinity, alignment: .topLeading)
        DayPatterns(patterns: patterns)
          .frame(maxWidth: .infinity, alignment: .topLeading)
      }
    }
    .loads(progress.patterns)
  }
}

private struct PatternColumn: Identifiable {
  /// A group with too few answers to count is a hollow outline and one without answers has no bar,
  /// so neither reads as a result.
  enum State {
    case best
    case counted
    case few
    case none
  }

  let id: String
  let name: String
  var shortName: String?
  var hours: String?
  var symbolName: String?
  let performance: ScorePerformance
  let state: State

  init(
    id: String, name: String, shortName: String? = nil, hours: String? = nil,
    symbolName: String? = nil, performance: ScorePerformance, isBest: Bool, minimumAnswers: Int
  ) {
    self.id = id
    self.name = name
    self.shortName = shortName
    self.hours = hours
    self.symbolName = symbolName
    self.performance = performance

    state =
      if performance.totalAnswers == 0 {
        .none
      } else if performance.totalAnswers < minimumAnswers {
        .few
      } else {
        isBest ? .best : .counted
      }
  }

  /// A group without answers says so instead of reading as 0%.
  func detail(minimumAnswers: Int) -> ChartPointDetail {
    let answers =
      performance.totalAnswers == 0
      ? String(
        localized: "No answers", table: "Progress",
        comment: "A day or part of the day without answers")
      : String(
        localized: "\(performance.totalAnswers) answers", table: "Progress",
        comment: "A count of answers")

    switch state {
    case .none:
      return ChartPointDetail(label: name, value: answers)
    case .few:
      return ChartPointDetail(
        label: name, value: wholePercent(performance.score),
        note: String(
          localized: "\(performance.totalAnswers) answers, needs \(minimumAnswers) to count",
          table: "Progress",
          comment:
            "A chart tooltip's last line for a weekday or a time of day with fewer answers than it needs before its score counts as a pattern, such as “7 answers, needs 10 to count”"
        ))
    case .best, .counted:
      return ChartPointDetail(label: name, value: wholePercent(performance.score), note: answers)
    }
  }
}

/// Columns on a 0–100% scale, rising from one baseline. Tapping a column shows its detail in a
/// tooltip beside it (`ChartInspection`).
private struct PatternChart: View {
  let title: Text
  /// Spoken before the best column's name.
  let bestLabel: String
  let columns: [PatternColumn]
  let minimumAnswers: Int

  @Environment(ChartInspection.self) private var inspection
  @Namespace private var chart
  @State private var size = CGSize.zero

  private var inspected: Int? {
    inspection.index(in: chart).flatMap { columns.indices.contains($0) ? $0 : nil }
  }

  var body: some View {
    let details = columns.map { $0.detail(minimumAnswers: minimumAnswers) }

    StatsBlock(title: title) {
      HStack(alignment: .top, spacing: 0) {
        ForEach(Array(columns.enumerated()), id: \.element.id) { index, column in
          PatternColumnView(
            column: column, value: details[index].value, isInspected: inspected == index
          )
          .frame(maxWidth: .infinity)
          .contentShape(.rect)
          .onTapGesture {
            inspection.inspect(index, in: chart)
          }
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(spoken(column, detail: details[index]))
        }
      }
      .chartsPlotText()
      .onGeometryChange(for: CGSize.self) {
        $0.size
      } action: {
        size = $0
      }
      .onContinuousHover { phase in
        switch phase {
        case .active(let location):
          let index = Int(location.x / max(columnWidth, 1))
          inspection.inspect(min(max(index, 0), columns.count - 1), in: chart)
        case .ended:
          inspection.close(chart)
        }
      }
      .chartTooltip(inspected.map { details[$0] }, at: columnFrame(inspected ?? 0))
      .chartPointKeys(
        [.leftArrow, .rightArrow], in: chart,
        from: columns.firstIndex { $0.state == .best } ?? 0
      ) { index, key in
        min(max(index + (key == .leftArrow ? -1 : 1), 0), columns.count - 1)
      }
    }
  }

  private var columnWidth: Double {
    size.width / Double(max(columns.count, 1))
  }

  private func columnFrame(_ index: Int) -> CGRect {
    CGRect(x: Double(index) * columnWidth, y: 0, width: columnWidth, height: size.height)
  }

  private func spoken(_ column: PatternColumn, detail: ChartPointDetail) -> String {
    [column.state == .best ? bestLabel : nil, column.name, column.hours, detail.value, detail.note]
      .compactMap(\.self).joined(separator: ", ")
  }
}

private struct PatternColumnView: View {
  let column: PatternColumn
  /// Its share of right answers, or that it has no answers.
  let value: String
  let isInspected: Bool

  @Environment(\.horizontalSizeClass) private var sizeClass
  @Environment(\.colorSchemeContrast) private var contrast
  /// Room over a full bar for its value and the best column's crown.
  @ScaledMetric(relativeTo: .caption) private var headroom = 48.0
  @ScaledMetric(relativeTo: .caption) private var crownSize = 24.0
  @ScaledMetric(relativeTo: .caption) private var chipSize = 36.0

  private let barWidth = 32.0
  private let barCorner = 3.0

  private var fullBar: Double {
    sizeClass == .regular ? 144 : 112
  }

  var body: some View {
    VStack(spacing: 8) {
      VStack(spacing: 0) {
        plot
          .frame(height: fullBar + headroom, alignment: .bottom)

        Rectangle()
          .fill(.border)
          .frame(height: 1)
      }

      if let symbolName = column.symbolName {
        Image(systemName: symbolName)
          .typeStyle(.body)
          .imageScale(.large)
          .foregroundStyle(chipIcon)
          .frame(width: chipSize, height: chipSize)
          .background(column.state == .best ? Color.success : Color.surface3, in: .circle)
      }

      VStack(spacing: 2) {
        Text(column.shortName ?? column.name)
          .typeStyle(.meta.weight(column.state == .best ? .medium : .regular))
          .foregroundStyle(column.state == .best ? Color(.foreground) : Color.mutedForeground)

        if let hours = column.hours {
          Text(hours)
            .typeStyle(.small.monospaced())
            .foregroundStyle(.faint)
        }
      }
      .lineLimit(1)
      .minimumScaleFactor(0.7)
      .padding(.horizontal, 2)
    }
    .padding(.top, 4)
    .padding(.bottom, 8)
    .background(
      isInspected ? Color.muted : .clear, in: .rect(cornerRadius: Radius.lg, style: .continuous))
  }

  private var plot: some View {
    VStack(spacing: 4) {
      if column.state == .best {
        Image(systemName: "crown")
          .typeStyle(.small.weight(.medium))
          .foregroundStyle(Color(.background))
          .frame(width: crownSize, height: crownSize)
          .background(.success, in: .circle)
      }

      Text(column.state == .none ? "–" : value)
        .typeStyle(.data.weight(column.state == .best ? .semibold : .regular))
        .foregroundStyle(valueColor)
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      if column.state != .none {
        bar
          // Keeps a malformed stored share inside the plot while the number says what was stored.
          .frame(height: max(fullBar * min(max(column.performance.score, 0), 100) / 100, 2))
          .frame(maxWidth: barWidth)
      }
    }
  }

  @ViewBuilder
  private var bar: some View {
    let shape = UnevenRoundedRectangle(
      topLeadingRadius: barCorner, topTrailingRadius: barCorner)

    switch column.state {
    case .best:
      shape.fill(.success)
    case .counted:
      shape.fill(Color.success.opacity(0.45))
    case .few:
      OpenBarOutline(cornerRadius: barCorner)
        .stroke(
          Color(.foreground).opacity(contrast == .increased ? 1 : 0.3),
          style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
    case .none:
      EmptyView()
    }
  }

  private var valueColor: Color {
    switch column.state {
    case .best, .counted:
      Color(.foreground)
    case .few, .none:
      .mutedForeground
    }
  }

  private var chipIcon: Color {
    switch column.state {
    case .best:
      Color(.background)
    case .counted:
      Color(.foreground)
    case .few, .none:
      .mutedForeground
    }
  }
}

/// A bar's sides and top with nothing along the baseline, where a dashed line would sit on the
/// chart's own.
private struct OpenBarOutline: Shape {
  let cornerRadius: Double

  func path(in rect: CGRect) -> Path {
    let line = rect.insetBy(dx: 0.5, dy: 0).offsetBy(dx: 0, dy: 0.5)
    let radius = min(cornerRadius, line.width / 2, line.height)
    var path = Path()

    path.move(to: CGPoint(x: line.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: line.minX, y: line.minY + radius))
    path.addArc(
      tangent1End: CGPoint(x: line.minX, y: line.minY),
      tangent2End: CGPoint(x: line.minX + radius, y: line.minY), radius: radius)
    path.addLine(to: CGPoint(x: line.maxX - radius, y: line.minY))
    path.addArc(
      tangent1End: CGPoint(x: line.maxX, y: line.minY),
      tangent2End: CGPoint(x: line.maxX, y: line.minY + radius), radius: radius)
    path.addLine(to: CGPoint(x: line.maxX, y: rect.maxY))

    return path
  }
}

private struct WeekPatterns: View {
  let patterns: ScorePatterns

  var body: some View {
    PatternChart(
      title: Text(
        "Throughout the week", tableName: "Progress",
        comment: "Title of the chart with a column per day of the week"),
      bestLabel: String(
        localized: "Best day", table: "Progress",
        comment: "The day of the week the learner answers best"),
      columns: patterns.weekdays.map { day in
        PatternColumn(
          id: day.weekday.rawValue, name: day.weekday.localizedTitle(),
          shortName: day.weekday.localizedShortTitle(), performance: day.performance,
          isBest: day.weekday == patterns.dayVerdict.best?.weekday,
          minimumAnswers: patterns.minimumAnswers)
      },
      minimumAnswers: patterns.minimumAnswers)
  }
}

private struct DayPatterns: View {
  let patterns: ScorePatterns

  /// The API counts parts of the day from midnight; a learner's day runs from the morning to the
  /// night after it.
  private let order: [ProgressDaypart] = [.morning, .afternoon, .evening, .night]

  var body: some View {
    PatternChart(
      title: Text(
        "Throughout the day", tableName: "Progress",
        comment: "Title of the chart with a column per part of the day"),
      bestLabel: String(
        localized: "Best time", table: "Progress",
        comment: "The part of the day the learner answers best"),
      columns: order.compactMap { daypart in
        patterns.dayparts.first { $0.daypart == daypart }
      }.map { time in
        PatternColumn(
          id: time.daypart.rawValue, name: String(localized: time.daypart.localizedTitle),
          hours: time.daypart.localizedTimeRange(), symbolName: time.daypart.symbolName,
          performance: time.performance,
          isBest: time.daypart == patterns.timeVerdict.best?.daypart,
          minimumAnswers: patterns.minimumAnswers)
      },
      minimumAnswers: patterns.minimumAnswers)
  }
}
