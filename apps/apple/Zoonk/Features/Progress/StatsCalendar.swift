import Accessibility
import SwiftUI

struct CalendarDay: Equatable, Sendable {
  let date: ProgressDate
  let step: Int
  let label: String
  let value: Double?
}

enum CalendarSteps {
  /// Relative steps, so a learner tells quieter days from busier ones even while their counts are
  /// small.
  static func activity(_ count: Int, maximum: Int) -> Int {
    guard count > 0, maximum > 0 else {
      return 0
    }

    return max(1, Int((Double(count) / Double(maximum) * 4).rounded(.up)))
  }

  static func energy(_ energy: Double?) -> Int {
    guard let energy, energy > 0 else {
      return 0
    }

    return energy >= 100 ? 5 : Int((energy / 25).rounded(.up))
  }

  static func defaultIndex(_ days: [CalendarDay]) -> Int {
    days.lastIndex { $0.step > 0 } ?? max(days.count - 1, 0)
  }

  /// The grid is column-major: up and down move a day within its week, left and right a week.
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

/// The grid is one control, so the squares stay small without hundreds of tiny targets.
struct StatsCalendar: View {
  let title: Text
  let gridLabel: Text
  let legendLabel: Text
  let low: Text
  let high: Text
  let shades: [Color]
  let days: [CalendarDay]
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

  private var cell: Double {
    let fitted = ((width - 2 * ringInset + gap) / Double(max(weeks, 1)) - gap).rounded(.down)
    return fitted >= 10 ? min(fitted, 16) : 20
  }

  private var fits: Bool {
    gridWidth(step: cell + gap) <= width
  }

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
        // Capped rather than fixed, here and on the grid, so a narrower width (a fold, a rotation,
        // a smaller window) can still reach the measurement the widths come from.
        ScrollView(.horizontal) {
          grid
        }
        .defaultScrollAnchor(.trailing)
        .frame(maxWidth: wholeWeeksWidth)
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
      low.fixedSize()

      ForEach(shades.indices, id: \.self) { index in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(shades[0])
          .overlay {
            if index > 0 {
              RoundedRectangle(cornerRadius: 2, style: .continuous).fill(shades[index])
            }
          }
          .aspectRatio(1, contentMode: .fit)
          .frame(maxWidth: swatchSize)
      }

      high.fixedSize()
    }
    .font(.caption2)
    .foregroundStyle(.secondary)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(legendLabel)
  }

  private var grid: some View {
    Canvas { context, _ in
      for (index, day) in days.enumerated() {
        let path = Path(roundedRect: square(index), cornerRadius: 2)
        context.fill(path, with: .color(shades[0]))

        if day.step > 0, shades.indices.contains(day.step) {
          context.fill(path, with: .color(shades[day.step]))
        }
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
    .frame(idealWidth: gridWidth(step: step), maxWidth: gridWidth(step: step))
    .frame(height: headerHeight + 7 * cell + 6 * gap + ringInset)
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

  /// A whole number of weeks, so no week is cut at the oldest edge.
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

  /// Not over the first two weeks, where a partial month would crowd the next.
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
