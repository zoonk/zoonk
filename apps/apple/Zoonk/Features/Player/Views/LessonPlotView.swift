import Accessibility
import Charts
import SwiftUI

struct LessonPlotView: View {
  let plot: LessonPlot

  @Environment(\.dynamicTypeSize) private var textSize
  @Environment(\.legibilityWeight) private var legibility
  @State private var width = 318.0

  private static let label = TypeStyle.meta
  private static let pointLabel = TypeStyle.meta.weight(.medium)

  private var scale: Double {
    Self.label.uiFont(textSize, legibility: legibility).pointSize / 12
  }

  private func textWidth(_ style: TypeStyle) -> (String) -> Double {
    let (scale, textSize, legibility) = (scale, textSize, legibility)
    return { style.width(of: $0, dynamicTypeSize: textSize, legibility: legibility) / scale }
  }

  var body: some View {
    let layout = LessonPlotLayout(
      plot, width: width / scale, textWidth: textWidth(Self.pointLabel))

    VStack(alignment: .leading, spacing: 12) {
      Text(plot.title)
        .typeStyle(.body.weight(.semibold))

      if plot.series.count > 1 {
        legend
      }

      VStack(alignment: .leading, spacing: 4) {
        LessonChartCaption(text: Self.caption(plot.yLabel, unit: plot.yUnit))
        drawing(layout)
          .frame(maxWidth: .infinity)
          .frame(height: LessonPlotLayout.height * scale)
          .onGeometryChange(for: Double.self) {
            $0.size.width
          } action: {
            width = $0
          }
        LessonChartCaption(text: Self.caption(plot.xLabel, unit: plot.xUnit))
      }
      .accessibilityRepresentation { spoken(layout) }
      .accessibilityChartDescriptor(LessonPlotDescriptor(plot: plot))

      if !layout.key.isEmpty {
        key(layout.key)
      }

      if let source = plot.source {
        LessonChartSource(source: source)
      }
    }
  }

  private func drawing(_ layout: LessonPlotLayout) -> some View {
    let scale = scale
    let label = Font(Self.label.uiFont(textSize, legibility: legibility)).monospacedDigit()
    let named = Font(Self.pointLabel.uiFont(textSize, legibility: legibility))
    let tickWidth = textWidth(Self.label)
    let plot = plot

    return Canvas { context, _ in
      let at = { (x: Double, y: Double) in CGPoint(x: x * scale, y: y * scale) }
      let rule = { (y: Double) in
        Path { path in
          path.move(to: at(layout.left, y))
          path.addLine(to: at(layout.plotRight, y))
        }
      }
      let resolver = context
      let text = { (string: String, font: Font, color: Color) in
        resolver.resolve(Text(verbatim: string).font(font).foregroundStyle(color))
      }

      for tick in layout.yTicks {
        let y = layout.y(tick.value)
        context.stroke(rule(y), with: .color(.vizGrid), lineWidth: 1)
        context.draw(
          text(tick.label, label, .mutedForeground),
          at: at(layout.left - LessonPlotLayout.labelGap, y), anchor: .trailing)
      }

      for reference in layout.references {
        context.stroke(
          rule(reference.y), with: .color(.mutedForeground),
          style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

        for (index, line) in reference.lines.enumerated() {
          let y = reference.top + LessonPlotLayout.lineHeight * (Double(index) + 0.5)
          context.draw(
            text(line, label, .mutedForeground),
            at: at(layout.referenceLeft, y), anchor: .leading)
        }
      }

      for (index, series) in plot.series.enumerated() {
        let mark = LessonSeriesMark(index)
        let points = layout.series[index].map { at($0.x, $0.y) }

        if series.mark != .points, points.count > 1 {
          context.stroke(
            Path { $0.addLines(points) }, with: .color(mark.tone), style: mark.lineStyle)
        }

        for (pointIndex, point) in points.enumerated()
        where LessonPlotLayout.drawsDot(
          index: pointIndex, mark: series.mark, pointCount: points.count,
          seriesCount: plot.series.count)
        {
          mark.drawPoint(at: point, scale: scale, in: context)
        }
      }

      for item in layout.labels {
        let anchor: UnitPoint =
          switch item.anchor {
          case .start: .leading
          case .middle: .center
          case .end: .trailing
          }
        context.draw(
          text(item.text, named, Color(.foreground)), at: at(item.x, item.y), anchor: anchor)
      }

      for tick in layout.xTicks {
        let number = text(tick.label, label, .mutedForeground)
        let size = number.measure(in: CGSize(width: Double.infinity, height: .infinity))
        let baseline = at(
          layout.tickCenter(tick, textWidth: tickWidth(tick.label)),
          layout.plotBottom + LessonPlotLayout.tickOffset)
        context.draw(
          number,
          in: CGRect(
            origin: CGPoint(
              x: baseline.x - size.width / 2, y: baseline.y - number.firstBaseline(in: size)),
            size: size))
      }
    }
  }

  private var legend: some View {
    FlowLayout(spacing: 12, rowSpacing: 4) {
      ForEach(Array(plot.series.enumerated()), id: \.offset) { index, series in
        let mark = LessonSeriesMark(index)

        HStack(spacing: 6) {
          Canvas { context, size in
            let middle = CGPoint(x: size.width / 2, y: size.height / 2)

            if series.mark != .points {
              context.stroke(
                Path { path in
                  path.move(to: CGPoint(x: 0, y: middle.y))
                  path.addLine(to: CGPoint(x: size.width, y: middle.y))
                }, with: .color(mark.tone), style: mark.lineStyle)
            }

            mark.drawPoint(at: middle, scale: 1, in: context)
          }
          .frame(width: series.mark == .points ? 10 : 16, height: 10)

          Text(series.name)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
    .accessibilityHidden(true)
  }

  private func key(_ entries: [LessonPlotLayout.KeyEntry]) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(entries, id: \.marker) { entry in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(verbatim: entry.marker)
            .typeStyle(Self.pointLabel)
            .monospacedDigit()
            .frame(minWidth: 16, alignment: .trailing)
          Text(entry.label)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
    .accessibilityHidden(true)
  }

  private static func caption(_ label: String, unit: String?) -> String {
    unit.map { "\(label) (\($0))" } ?? label
  }

  @ViewBuilder
  private func spoken(_ layout: LessonPlotLayout) -> some View {
    let scale = LessonPlotScale(plot)
    let x = { (value: Double) in
      ActivityNumberFormat.format(value, unit: plot.xUnit, grouping: layout.groupsX)
    }
    let y = { (value: Double) in ActivityNumberFormat.format(value, unit: plot.yUnit) }
    let (left, right) = (x(scale.x.domain.lowerBound), x(scale.x.domain.upperBound))
    let (bottom, top) = (y(scale.y.domain.lowerBound), y(scale.y.domain.upperBound))

    Text("Horizontal axis: \(plot.xLabel), from \(left) to \(right)", tableName: "Player")
    Text("Vertical axis: \(plot.yLabel), from \(bottom) to \(top)", tableName: "Player")

    ForEach(Array(plot.series.enumerated()), id: \.offset) { _, series in
      Text(plot.series.count > 1 ? series.name : plot.yLabel)
        .accessibilityValue(
          series.points.map { point in
            let values = "\(x(point.x)), \(y(point.y))"
            return point.label.map { "\($0): \(values)" } ?? values
          }
          .joined(separator: "; "))
    }

    if !plot.references.isEmpty {
      Text("Reference lines", tableName: "Player")
        .accessibilityValue(
          plot.references.map { "\($0.label): \(y($0.y))" }.joined(separator: "; "))
    }
  }
}

private struct LessonPlotDescriptor: AXChartDescriptorRepresentable {
  let plot: LessonPlot

  func makeChartDescriptor() -> AXChartDescriptor {
    let scale = LessonPlotScale(plot)
    let axis = { (title: String, unit: String?, range: LessonPlotScale.Axis) in
      AXNumericDataAxisDescriptor(
        title: title, range: range.domain, gridlinePositions: range.ticks
      ) { ActivityNumberFormat.format($0, unit: unit) }
    }

    return AXChartDescriptor(
      title: plot.title, summary: nil, xAxis: axis(plot.xLabel, plot.xUnit, scale.x),
      yAxis: axis(plot.yLabel, plot.yUnit, scale.y), additionalAxes: [],
      series: plot.series.map { series in
        AXDataSeriesDescriptor(
          name: series.name, isContinuous: series.mark != .points,
          dataPoints: series.points.map { AXDataPoint(x: $0.x, y: $0.y, label: $0.label) })
      })
  }
}

extension LessonSeriesMark {
  fileprivate func drawPoint(at center: CGPoint, scale: Double, in context: GraphicsContext) {
    let path = pointShape.path.applying(
      CGAffineTransform(translationX: center.x, y: center.y).scaledBy(x: scale, y: scale))

    if pointShape == .cross {
      context.stroke(
        path, with: .color(tone), style: StrokeStyle(lineWidth: 2 * scale, lineCap: .round))
    } else if isOpen {
      context.fill(path, with: .color(.card))
      context.stroke(
        path, with: .color(tone),
        style: StrokeStyle(lineWidth: Self.openStroke * scale, lineJoin: .round))
    } else {
      context.fill(path, with: .color(tone))
    }
  }
}

extension LessonSeriesMark.PointShape {
  /// Around the point's center, sized so each shape weighs about the same as the 3.5-point dot.
  fileprivate var path: Path {
    let polygon = { (corners: [CGPoint]) in
      Path {
        $0.addLines(corners)
        $0.closeSubpath()
      }
    }

    return switch self {
    case .circle: Path(ellipseIn: CGRect(x: -3.5, y: -3.5, width: 7, height: 7))
    case .square: Path(CGRect(x: -3.1, y: -3.1, width: 6.2, height: 6.2))
    case .diamond:
      polygon([
        CGPoint(x: 0, y: -4.5), CGPoint(x: 4.5, y: 0), CGPoint(x: 0, y: 4.5),
        CGPoint(x: -4.5, y: 0),
      ])
    case .triangle:
      polygon([CGPoint(x: 0, y: -4.2), CGPoint(x: 4.4, y: 3.2), CGPoint(x: -4.4, y: 3.2)])
    case .cross:
      Path { path in
        path.move(to: CGPoint(x: -3, y: -3))
        path.addLine(to: CGPoint(x: 3, y: 3))
        path.move(to: CGPoint(x: -3, y: 3))
        path.addLine(to: CGPoint(x: 3, y: -3))
      }
    }
  }
}
