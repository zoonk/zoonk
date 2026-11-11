import Accessibility
import Charts
import SwiftUI

/// A chart in a lesson or a question, main's `ChartVisual`. A bar chart whose category names don't
/// fit under its bars, or whose bars would thin to slivers, runs its bars sideways, each name in
/// full above its bars.
struct LessonChartView: View {
  let chart: LessonChart

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight
  @State private var width: Double?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(chart.title)
        .typeStyle(.body.weight(.semibold))

      if chart.series.count > 1 {
        legend
      }

      plot

      if let source = chart.source {
        Text(source)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .onGeometryChange(for: Double.self) {
      $0.size.width
    } action: {
      width = $0
    }
  }

  @ViewBuilder private var plot: some View {
    let format = LessonChartFormat(chart: chart) { style, text in
      style.width(of: text, dynamicTypeSize: dynamicTypeSize, legibility: legibilityWeight)
    }

    let nameRoom = width.map(format.nameRoom)

    if chart.chart == .line {
      UprightChart(chart: chart, format: format, scale: nil, nameRoom: nil)
    } else if let width, let nameRoom, !format.barsFitUpright(nameRoom) {
      SidewaysBars(chart: chart, format: format, scale: LessonChartScale(chart), width: width)
    } else {
      UprightChart(
        chart: chart, format: format, scale: LessonChartScale(chart), nameRoom: nameRoom)
    }
  }

  private var legend: some View {
    FlowLayout(spacing: 12, rowSpacing: 4) {
      ForEach(Array(chart.series.enumerated()), id: \.offset) { index, series in
        HStack(spacing: 6) {
          LessonSeriesMark(index).swatch(chart.chart)
            .frame(width: 10, height: 10)

          Text(series.name)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
  }
}

/// An open bar's outline as a ring to fill or clip with `FillStyle.outline`, since Swift Charts'
/// bars take no stroke.
private struct BarOutline: Shape {
  let radius: Double
  let lineWidth: Double

  func path(in rect: CGRect) -> Path {
    var path = Path(roundedRect: rect, cornerRadius: radius)
    path.addRoundedRect(
      in: rect.insetBy(dx: lineWidth, dy: lineWidth),
      cornerSize: CGSize(width: radius - lineWidth, height: radius - lineWidth))
    return path
  }
}

extension FillStyle {
  fileprivate static let outline = FillStyle(eoFill: true)
}

/// How a chart draws one series so it stays apart from the others without relying on color, as
/// main's `getSeriesMark`: a line's points take a shape, and once the six colors are used they come
/// back drawn open (outlined bars, dashed lines with hollow points).
private struct LessonSeriesMark {
  static let openStroke = 1.5
  static let openFill = 0.2
  static let pointSize = 8.0
  private static let tones: [Color] = [
    .vizAccent, .vizSecondary, .vizHighlight, .vizSeries4, .vizSeries5, .vizSeries6,
  ]
  private static let shapes: [BasicChartSymbolShape] = [
    .circle, .square, .diamond, .triangle, .cross,
  ]

  let tone: Color
  let shape: BasicChartSymbolShape
  let isOpen: Bool

  init(_ index: Int) {
    tone = Self.tones[index % Self.tones.count]
    shape = Self.shapes[index % Self.shapes.count]
    isOpen = (index / Self.tones.count) % 2 == 1
  }

  var lineStyle: StrokeStyle {
    StrokeStyle(lineWidth: 2, lineJoin: .round, dash: isOpen ? [5, 4] : [])
  }

  func outline(radius: Double) -> BarOutline {
    BarOutline(radius: radius, lineWidth: Self.openStroke)
  }

  @ViewBuilder
  func bar(radius: Double) -> some View {
    if isOpen {
      RoundedRectangle(cornerRadius: radius)
        .fill(tone.opacity(Self.openFill))
        .overlay { outline(radius: radius).fill(tone, style: .outline) }
    } else {
      RoundedRectangle(cornerRadius: radius).fill(tone)
    }
  }

  /// A solid point. Swift Charts draws a line's own symbols hollow, so only open series use them.
  var point: some View {
    shape.foregroundStyle(tone).frame(width: Self.pointSize, height: Self.pointSize)
  }

  /// A legend's sample of the series, drawn as the plot draws it.
  @ViewBuilder
  func swatch(_ chart: LessonChart.Style) -> some View {
    if chart != .line {
      bar(radius: 2)
    } else if isOpen {
      shape.strokeBorder(lineWidth: Self.openStroke).foregroundStyle(tone)
    } else {
      shape.foregroundStyle(tone)
    }
  }
}

/// What a chart's text says and how wide it draws, so a layout can tell what fits before drawing.
private struct LessonChartFormat {
  static let label = TypeStyle.meta
  static let value = TypeStyle.meta.weight(.medium)
  /// What Swift Charts adds beside the value axis's widest label: its tick and the gap after it.
  static let valueAxisRoom = 10.0
  /// Kept between neighboring names under upright bars, so they don't read as one.
  static let nameGap = 4.0
  /// Main's bars' corners.
  static let barRadius = 3.0

  let chart: LessonChart
  let width: (TypeStyle, String) -> Double

  var valueCaption: String {
    chart.unit.map { "\(chart.valueLabel) (\($0))" } ?? chart.valueLabel
  }

  func tick(_ value: Double) -> String {
    ActivityNumberFormat.format(value, compact: true)
  }

  func value(_ value: Double) -> String {
    ActivityNumberFormat.format(value)
  }

  func spoken(_ value: Double) -> String {
    ActivityNumberFormat.format(value, unit: chart.unit)
  }

  /// The width a name has under its upright bars: its band, as Swift Charts splits the plot left of
  /// the value axis, less a gap from its neighbors.
  func nameRoom(width: Double) -> Double {
    let ticks = LessonChartScale(chart).ticks.map { self.width(Self.label, tick($0)) }
    let plot = width - (ticks.max() ?? 0) - Self.valueAxisRoom

    return plot / Double(max(chart.categories.count, 1)) - Self.nameGap
  }

  func barsFitUpright(_ nameRoom: Double) -> Bool {
    LessonChartNames.fitUnderBars(chart.categories, band: nameRoom) { self.width(Self.label, $0) }
      && LessonChartBars.fitSideBySide(band: nameRoom + Self.nameGap, series: chart.series.count)
  }

  /// What VoiceOver reads for a category: each series' value, named when there are several.
  func spokenValues(at index: Int) -> String {
    chart.series.compactMap { series in
      series.values.indices.contains(index)
        ? chart.series.count > 1
          ? "\(series.name), \(spoken(series.values[index]))" : spoken(series.values[index])
        : nil
    }
    .joined(separator: "; ")
  }
}

/// Swift Charts' bars or lines, with the names under them. A line chart keeps Swift Charts' own
/// value axis; a bar chart takes `scale`, so it reads the same whichever way its bars run.
private struct UprightChart: View {
  let chart: LessonChart
  let format: LessonChartFormat
  let scale: LessonChartScale?
  /// Swift Charts lets a name run past its bar's band, so upright bars wrap each name to it.
  let nameRoom: Double?

  private struct Point: Identifiable {
    let series: String
    let mark: LessonSeriesMark
    let category: String
    let value: Double
    var id: String { "\(series)-\(category)" }
  }

  private var points: [Point] {
    chart.series.enumerated().flatMap { index, series in
      zip(chart.categories, series.values).map {
        Point(series: series.name, mark: LessonSeriesMark(index), category: $0, value: $1)
      }
    }
  }

  /// An open bar's fill is a wash of its color, under its outline.
  private var tones: [Color] {
    chart.series.indices.map(LessonSeriesMark.init).map {
      scale != nil && $0.isOpen ? $0.tone.opacity(LessonSeriesMark.openFill) : $0.tone
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Caption(text: format.valueCaption)

      plot
        .chartForegroundStyleScale(domain: chart.series.map(\.name), range: tones)
        .chartLegend(.hidden)
        .chartXAxis {
          AxisMarks { value in
            AxisValueLabel {
              if let name = value.as(String.self) {
                Text(name)
                  .typeStyle(LessonChartFormat.label)
                  .foregroundStyle(.mutedForeground)
                  .multilineTextAlignment(.center)
                  .lineLimit(LessonChartNames.maxLines)
                  .frame(width: nameRoom.map { CGFloat($0) })
              }
            }
          }
        }
        .chartYAxis {
          if let scale {
            AxisMarks(values: scale.ticks) { valueMark($0) }
          } else {
            AxisMarks { valueMark($0) }
          }
        }
        .frame(minHeight: 200)

      Caption(text: chart.categoryLabel)
        .frame(maxWidth: .infinity)
    }
  }

  @ViewBuilder private var plot: some View {
    if let scale {
      Chart(points) { point in
        bar(point, scale: scale)
          .foregroundStyle(by: .value(verbatim: "Series", point.series))
          .accessibilityLabel(
            chart.series.count > 1 ? "\(point.category), \(point.series)" : point.category
          )
          .accessibilityValue(format.spoken(point.value))

        if point.mark.isOpen {
          bar(point, scale: scale)
            .foregroundStyle(point.mark.tone)
            .clipShape(point.mark.outline(radius: LessonChartFormat.barRadius), style: .outline)
            .accessibilityHidden(true)
        }
      }
      .chartYScale(domain: scale.domain)
    } else {
      Chart(points) { point in
        let line = LineMark(
          x: .value(chart.categoryLabel, point.category), y: .value(chart.valueLabel, point.value)
        )
        .foregroundStyle(by: .value(verbatim: "Series", point.series))
        .lineStyle(point.mark.lineStyle)

        if point.mark.isOpen {
          line.symbol(point.mark.shape.strokeBorder(lineWidth: LessonSeriesMark.openStroke))
        } else {
          line.symbol { point.mark.point }
        }
      }
      .chartYScale(
        domain: .automatic(includesZero: chart.axisStart == nil || chart.axisStart == 0))
    }
  }

  private func bar(_ point: Point, scale: LessonChartScale) -> some ChartContent {
    BarMark(
      x: .value(chart.categoryLabel, point.category),
      yStart: .value(chart.valueLabel, scale.origin),
      yEnd: .value(chart.valueLabel, point.value),
      width: .inset(LessonChartBars.inset)
    )
    .position(
      by: .value(verbatim: "Series", point.series), span: .ratio(LessonChartBars.groupShare)
    )
    .cornerRadius(LessonChartFormat.barRadius)
  }

  @AxisMarkBuilder private func valueMark(_ value: AxisValue) -> some AxisMark {
    AxisGridLine().foregroundStyle(.vizGrid)
    AxisTick().foregroundStyle(.vizGrid)
    AxisValueLabel {
      if let number = value.as(Double.self) {
        Text(verbatim: format.tick(number))
          .typeStyle(LessonChartFormat.label)
          .foregroundStyle(.mutedForeground)
      }
    }
  }
}

/// Bars running sideways from the value axis, one row per category with its name in full above its
/// bars, for names that don't fit under upright bars.
private struct SidewaysBars: View {
  let chart: LessonChart
  let format: LessonChartFormat
  let scale: LessonChartScale
  let width: Double

  /// Grows with the text, so a bar stays as tall as the value printed beside it.
  @ScaledMetric(relativeTo: .caption) private var barHeight = 14.0
  private let valueGap = 4.0

  /// Room kept left and right of the plot for the values printed past the bars' ends; none when
  /// they'd take more than a third of the width, and the ticks read the chart alone.
  private var valueRoom: (left: Double, right: Double)? {
    let values = chart.series.flatMap(\.values)
    let room = { (side: [Double]) in
      side.map { format.width(LessonChartFormat.value, format.value($0)) + valueGap }.max() ?? 0
    }
    let left = room(values.filter { $0 < scale.origin })
    let right = room(values.filter { $0 >= scale.origin })

    return max(left, right) <= width / 3 ? (left, right) : nil
  }

  private func x(_ value: Double) -> Double {
    let room = valueRoom ?? (0, 0)
    let span = scale.domain.upperBound - scale.domain.lowerBound
    let share = span > 0 ? (value - scale.domain.lowerBound) / span : 0

    return room.left + ChartsMath.clamp(share, 0, 1) * (width - room.left - room.right)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Caption(text: chart.categoryLabel)

      VStack(alignment: .leading, spacing: 12) {
        ForEach(Array(chart.categories.enumerated()), id: \.offset) { index, name in
          row(index: index, name: name)
        }
      }
      .background(alignment: .leading) { gridlines }
      .accessibilityElement(children: .contain)
      .accessibilityChartDescriptor(SidewaysBarsDescriptor(chart: chart, scale: scale))

      ticks

      Caption(text: format.valueCaption)
    }
  }

  private func row(index: Int, name: String) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(name)
        .typeStyle(LessonChartFormat.label)
        .foregroundStyle(.mutedForeground)
        .frame(maxWidth: .infinity, alignment: .leading)

      VStack(alignment: .leading, spacing: 2) {
        ForEach(Array(chart.series.enumerated()), id: \.offset) { seriesIndex, series in
          if series.values.indices.contains(index) {
            bar(series.values[index], mark: LessonSeriesMark(seriesIndex))
          }
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(name)
    .accessibilityValue(format.spokenValues(at: index))
  }

  private func bar(_ value: Double, mark: LessonSeriesMark) -> some View {
    let (start, end) = (x(scale.origin), x(value))
    let label = format.value(value)
    let labelWidth = format.width(LessonChartFormat.value, label)

    return ZStack(alignment: .leading) {
      mark.bar(radius: LessonChartFormat.barRadius)
        .frame(width: max(abs(end - start), 1), height: barHeight)
        .offset(x: min(start, end))

      if valueRoom != nil {
        Text(verbatim: label)
          .typeStyle(LessonChartFormat.value)
          .fixedSize()
          .offset(x: value < scale.origin ? end - valueGap - labelWidth : end + valueGap)
      }
    }
    .frame(width: width, alignment: .leading)
    .frame(minHeight: barHeight)
  }

  private var gridlines: some View {
    ZStack(alignment: .leading) {
      ForEach(scale.ticks, id: \.self) { tick in
        Rectangle()
          .fill(.vizGrid)
          .frame(width: 1)
          .offset(x: ChartsMath.clamp(x(tick) - 0.5, 0, width - 1))
      }
    }
    .frame(width: width, alignment: .leading)
  }

  private var ticks: some View {
    let labels = scale.ticks.map { tick in
      let text = format.tick(tick)
      let labelWidth = format.width(LessonChartFormat.label, text)
      let left = ChartsMath.clamp(x(tick) - labelWidth / 2, 0, max(width - labelWidth, 0))

      return (text: text, left: left, right: left + labelWidth)
    }

    return ZStack(alignment: .leading) {
      ForEach(LessonChartTicks.labeled(labels.map { ($0.left, $0.right) }), id: \.self) { index in
        Text(verbatim: labels[index].text)
          .typeStyle(LessonChartFormat.label)
          .foregroundStyle(.mutedForeground)
          .fixedSize()
          .offset(x: labels[index].left)
      }
    }
    .frame(width: width, alignment: .leading)
    .accessibilityHidden(true)
  }
}

private struct Caption: View {
  let text: String

  var body: some View {
    Text(text)
      .typeStyle(LessonChartFormat.label)
      .foregroundStyle(.mutedForeground)
      .accessibilityHidden(true)
  }
}

/// Audio Graphs for sideways bars, which Swift Charts gives upright ones on its own. The values'
/// axis is the descriptor's y axis whichever way the bars run.
private struct SidewaysBarsDescriptor: AXChartDescriptorRepresentable {
  let chart: LessonChart
  let scale: LessonChartScale

  func makeChartDescriptor() -> AXChartDescriptor {
    let spoken = { (value: Double) in ActivityNumberFormat.format(value, unit: chart.unit) }

    return AXChartDescriptor(
      title: chart.title,
      summary: nil,
      xAxis: AXCategoricalDataAxisDescriptor(
        title: chart.categoryLabel, categoryOrder: chart.categories),
      yAxis: AXNumericDataAxisDescriptor(
        title: chart.valueLabel, range: scale.domain, gridlinePositions: scale.ticks,
        valueDescriptionProvider: spoken),
      additionalAxes: [],
      series: chart.series.map { series in
        AXDataSeriesDescriptor(
          name: series.name, isContinuous: false,
          dataPoints: zip(chart.categories, series.values).map {
            AXDataPoint(x: $0, y: $1)
          })
      })
  }
}
