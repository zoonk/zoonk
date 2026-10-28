import Accessibility
import SwiftUI

/// One day of a contribution calendar: its date, its shade's step and the sentence the readout says
/// for it ("Oct 12 · 3 activities").
struct CalendarDay: Equatable, Sendable {
  let date: ProgressDate
  let step: Int
  let label: String
  /// The day's number for the audio graph; nil where there's none (a day without Energy).
  let value: Double?
}

enum CalendarSteps {
  /// Activity's relative steps (1–4), so a learner tells quieter days from busier ones even while
  /// their counts are small; 0 is no study.
  static func activity(_ count: Int, maximum: Int) -> Int {
    guard count > 0, maximum > 0 else {
      return 0
    }

    return max(1, Int((Double(count) / Double(maximum) * 4).rounded(.up)))
  }

  /// Energy's fixed 25-point steps (1–4), the fifth only for full Energy; 0 is none recorded.
  static func energy(_ energy: Double?) -> Int {
    guard let energy, energy > 0 else {
      return 0
    }

    return energy >= 100 ? 5 : Int((energy / 25).rounded(.up))
  }

  /// The day the readout starts on: the newest with something on it, else the newest.
  static func defaultIndex(_ days: [CalendarDay]) -> Int {
    days.lastIndex { $0.step > 0 } ?? max(days.count - 1, 0)
  }

  /// The day a key moves to, in the grid's column-major order: up and down a day within its week,
  /// left and right a week; at an edge it stays.
  static func index(from index: Int, key: KeyEquivalent, count: Int) -> Int {
    let weekday = index % 7

    switch key {
    case .upArrow:
      return weekday == 0 ? index : index - 1
    case .downArrow:
      return weekday == 6 || index + 1 >= count ? index : index + 1
    case .leftArrow:
      return index < 7 ? index : index - 7
    case .rightArrow:
      return index + 7 >= count ? index : index + 7
    default:
      return index
    }
  }
}

/// A year of days as small squares, the way contribution charts look, read one day at a time: the
/// readout under the grid says the day tapped, hovered or reached with the arrow keys (VoiceOver
/// swipes up and down through the days). The grid is one control, so the squares stay small
/// without hundreds of tiny targets. Days come Sunday first, seven to a column.
struct StatsCalendar: View {
  let title: Text
  /// What the grid shows, as VoiceOver names it ("Activity by day").
  let gridLabel: Text
  /// The key read as one phrase ("Activity from less to more").
  let legendLabel: Text
  let low: Text
  let high: Text
  /// One color per step, from none to the most.
  let shades: [Color]
  let days: [CalendarDay]
  /// The audio graph's title and its one-line summary.
  let chartTitle: String
  let chartSummary: String

  @State private var picked: Int?
  @State private var width = 0.0
  @ScaledMetric(relativeTo: .caption2) private var headerHeight = 16.0
  @ScaledMetric(relativeTo: .caption2) private var swatchSize = 10.0

  private let gap = 2.0
  private let ringInset = 3.0

  private var activeIndex: Int {
    picked ?? CalendarSteps.defaultIndex(days)
  }

  private var weeks: Int {
    (days.count + 6) / 7
  }

  /// With room, the year fills the width at 10–16pt a square; narrower, it keeps 20pt squares to
  /// tap and scrolls from its newest edge.
  private var cell: Double {
    let fitted = ((width - 2 * ringInset + gap) / Double(max(weeks, 1)) - gap).rounded(.down)
    return fitted >= 10 ? min(fitted, 16) : 20
  }

  private var fits: Bool {
    gridWidth(step: cell + gap) <= width
  }

  /// The distance from one week to the next: a year that fits spreads its weeks across the width.
  private var step: Double {
    guard fits, weeks > 1 else {
      return cell + gap
    }

    return (width - 2 * ringInset - cell) / Double(weeks - 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .firstTextBaseline) {
          title.font(.headline)
          Spacer(minLength: 16)
          legend
        }

        VStack(alignment: .leading, spacing: 4) {
          title.font(.headline)
          legend
        }
      }

      if fits {
        grid
      } else {
        ScrollView(.horizontal) {
          grid
        }
        .defaultScrollAnchor(.trailing)
        .frame(width: wholeWeeksWidth)
        .frame(maxWidth: .infinity, alignment: .trailing)
      }

      if days.indices.contains(activeIndex) {
        Text(days[activeIndex].label)
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onGeometryChange(for: Double.self) {
      $0.size.width
    } action: {
      width = $0
    }
  }

  private var legend: some View {
    HStack(spacing: 4) {
      low

      ForEach(shades.indices, id: \.self) { index in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(shades[index])
          .frame(width: swatchSize, height: swatchSize)
      }

      high
    }
    .font(.caption2)
    .foregroundStyle(.secondary)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(legendLabel)
  }

  private var grid: some View {
    Canvas { context, _ in
      for (index, day) in days.enumerated() {
        context.fill(
          Path(roundedRect: square(index), cornerRadius: 2),
          with: .color(shades.indices.contains(day.step) ? shades[day.step] : shades[0]))
      }

      if let picked, days.indices.contains(picked) {
        context.stroke(
          Path(roundedRect: square(picked).insetBy(dx: -2, dy: -2), cornerRadius: 3),
          with: .color(.primary), lineWidth: 2)
      }

      for (week, text, isLast) in monthLabels {
        let label = context.resolve(
          Text(text).font(.caption2.monospacedDigit()).foregroundStyle(Color(.tertiaryLabel)))
        let x = ringInset + Double(week) * step + (isLast ? cell : 0)
        context.draw(label, at: CGPoint(x: x, y: 0), anchor: isLast ? .topTrailing : .topLeading)
      }
    }
    .frame(width: gridWidth(step: step), height: headerHeight + 7 * cell + 6 * gap + ringInset)
    .contentShape(.rect)
    .gesture(SpatialTapGesture().onEnded { pick(at: $0.location) })
    .onContinuousHover { phase in
      if case .active(let location) = phase {
        pick(at: location)
      }
    }
    .focusable()
    .onKeyPress(keys: [.upArrow, .downArrow, .leftArrow, .rightArrow]) { press in
      picked = CalendarSteps.index(from: activeIndex, key: press.key, count: days.count)
      return .handled
    }
    .accessibilityElement()
    .accessibilityLabel(gridLabel)
    .accessibilityValue(days.indices.contains(activeIndex) ? days[activeIndex].label : "")
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        picked = min(activeIndex + 1, days.count - 1)
      case .decrement:
        picked = max(activeIndex - 1, 0)
      @unknown default:
        break
      }
    }
    .accessibilityAction(
      named: Text(
        "Next week", tableName: "Progress",
        comment: "VoiceOver action moving a calendar's readout a week later")
    ) {
      picked = min(activeIndex + 7, days.count - 1)
    }
    .accessibilityAction(
      named: Text(
        "Previous week", tableName: "Progress",
        comment: "VoiceOver action moving a calendar's readout a week earlier")
    ) {
      picked = max(activeIndex - 7, 0)
    }
    .accessibilityChartDescriptor(
      CalendarChartDescriptor(title: chartTitle, summary: chartSummary, days: days))
  }

  /// The scrolling viewport, a whole number of weeks wide from its newest edge, so no week is cut
  /// at its oldest edge (the gap before the first week shown stays inside it).
  private var wholeWeeksWidth: Double {
    let columns = max(((width - ringInset) / (cell + gap)).rounded(.down), 1)
    return columns * (cell + gap) + ringInset
  }

  private func gridWidth(step: Double) -> Double {
    Double(max(weeks - 1, 0)) * step + cell + 2 * ringInset
  }

  private func square(_ index: Int) -> CGRect {
    CGRect(
      x: ringInset + Double(index / 7) * step,
      y: headerHeight + Double(index % 7) * (cell + gap),
      width: cell, height: cell)
  }

  /// A month's short name over the week holding its first day; not over the first two weeks, where
  /// a partial month would crowd the next, and the last week's ends at the grid's edge.
  private var monthLabels: [(week: Int, text: String, isLast: Bool)] {
    var utc = Calendar(identifier: .gregorian)
    utc.timeZone = .gmt

    return days.indices.compactMap { index in
      let day = days[index]
      let week = index / 7

      guard day.date.day == 1, week >= 2, let date = day.date.date(in: .gmt) else {
        return nil
      }

      var format = Date.FormatStyle.dateTime.month(.abbreviated)
      format.timeZone = .gmt
      return (week, date.formatted(format), week == weeks - 1)
    }
  }

  private func pick(at location: CGPoint) {
    let week = Int(((location.x - ringInset + (step - cell) / 2) / step).rounded(.down))
    let weekday = Int(((location.y - headerHeight) / (cell + gap)).rounded(.down))

    guard (0..<7).contains(weekday), week >= 0 else {
      return
    }

    let index = week * 7 + weekday

    if days.indices.contains(index), picked != index {
      picked = index
    }
  }
}

/// The calendar as VoiceOver's audio graph and chart summary: one point per day.
private struct CalendarChartDescriptor: AXChartDescriptorRepresentable {
  let title: String
  let summary: String
  let days: [CalendarDay]

  func makeChartDescriptor() -> AXChartDescriptor {
    let values = days.compactMap(\.value)
    let labels = days.map(\.label)

    let xAxis = AXNumericDataAxisDescriptor(
      title: String(
        localized: "Day", table: "Progress", comment: "Audio graph axis: the calendar's days"),
      range: 0...Double(max(days.count - 1, 1)),
      gridlinePositions: []
    ) { index in
      labels.indices.contains(Int(index)) ? labels[Int(index)] : ""
    }

    let yAxis = AXNumericDataAxisDescriptor(
      title: title,
      range: 0...max(values.max() ?? 1, 1),
      gridlinePositions: []
    ) { value in
      value.formatted()
    }

    let points = days.enumerated().compactMap { index, day in
      day.value.map { AXDataPoint(x: Double(index), y: $0) }
    }

    return AXChartDescriptor(
      title: title, summary: summary, xAxis: xAxis, yAxis: yAxis, additionalAxes: [],
      series: [AXDataSeriesDescriptor(name: title, isContinuous: false, dataPoints: points)])
  }
}

/// Formats a calendar's days as its readout says them ("Oct 12"), keeping the API's date-only
/// value, with the year only for a day in an earlier year than the newest one.
func calendarDayFormatter(newest: ProgressDate?) -> (ProgressDate) -> String {
  var sameYear = Date.FormatStyle.dateTime.month(.abbreviated).day()
  sameYear.timeZone = .gmt
  var otherYear = Date.FormatStyle.dateTime.month(.abbreviated).day().year()
  otherYear.timeZone = .gmt

  return { day in
    guard let date = day.date(in: .gmt) else {
      return ""
    }

    return date.formatted(day.year == newest?.year ? sameYear : otherYear)
  }
}
