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

  private var textScale: Double {
    Self.label.uiFont(textSize, legibility: legibility).pointSize / 12
  }

  /// The drawing writes digits tabular, each as wide as a zero.
  private func textWidth(_ style: TypeStyle) -> (String) -> Double {
    let (textScale, textSize, legibility) = (textScale, textSize, legibility)
    return {
      style.width(
        of: $0.replacing(/\d/, with: "0"), dynamicTypeSize: textSize, legibility: legibility)
        / textScale
    }
  }

  /// A style at 12 points; the drawing scales it with everything else.
  private func drawingFont(_ style: TypeStyle) -> UIFont {
    let font = style.uiFont(textSize, legibility: legibility)
    return font.withSize(font.pointSize / textScale)
  }

  var body: some View {
    let measure = LessonPlotLayout.Measure(
      text: textWidth(Self.label), name: textWidth(Self.pointLabel))
    let scale = LessonPlotLayout.scale(plot, text: textScale, width: width, measure: measure)
    let layout = LessonPlotLayout(plot, width: width / scale, measure: measure)

    VStack(alignment: .leading, spacing: 12) {
      Text(plot.title)
        .typeStyle(.body.weight(.semibold))

      if plot.series.count > 1 {
        legend
      }

      VStack(alignment: .leading, spacing: 4) {
        LessonChartCaption(text: Self.caption(plot.yLabel, unit: plot.yUnit))
        drawing(layout, scale: scale)
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

  /// Drawn at 12-point text and scaled whole, text, lines and points together, as main's drawing.
  private func drawing(_ layout: LessonPlotLayout, scale: Double) -> some View {
    let label = Font(drawingFont(Self.label)).monospacedDigit()
    let named = drawingFont(Self.pointLabel).monospacedDigits
    let plot = plot

    return Canvas { context, _ in
      context.scaleBy(x: scale, y: scale)

      let rule = { (y: Double) in
        Path { path in
          path.move(to: CGPoint(x: layout.left, y: y))
          path.addLine(to: CGPoint(x: layout.plotRight, y: y))
        }
      }
      let resolver = context
      let text = { (string: String) in
        resolver.resolve(Text(verbatim: string).font(label).foregroundStyle(.mutedForeground))
      }

      for tick in layout.yTicks {
        let y = layout.y(tick.value)

        if tick.line {
          context.stroke(rule(y), with: .color(.vizGrid), lineWidth: 1)
        }

        context.draw(
          text(tick.label), at: CGPoint(x: layout.left - LessonPlotLayout.labelGap, y: y),
          anchor: .trailing)
      }

      for reference in layout.references {
        context.stroke(
          rule(reference.y), with: .color(.mutedForeground),
          style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

        for (index, line) in reference.lines.enumerated() {
          let y = reference.top + LessonPlotLayout.lineHeight * (Double(index) + 0.5)
          context.draw(text(line), at: CGPoint(x: reference.x, y: y), anchor: .leading)
        }
      }

      for (index, series) in plot.series.enumerated() {
        let mark = LessonSeriesMark(index)
        let points = layout.series[index].map { CGPoint(x: $0.x, y: $0.y) }

        if series.mark != .points, points.count > 1 {
          context.stroke(
            Path { $0.addLines(points) }, with: .color(mark.tone), style: mark.lineStyle)
        }

        for (pointIndex, point) in points.enumerated()
        where LessonPlotLayout.drawsDot(
          index: pointIndex, mark: series.mark, pointCount: points.count,
          seriesCount: plot.series.count)
        {
          mark.drawPoint(at: point, scale: 1, in: context)
        }
      }

      for item in layout.labels {
        context.drawName(item, font: named)
      }

      for tick in layout.xTicks {
        let number = text(tick.label)
        let size = number.measure(in: CGSize(width: Double.infinity, height: .infinity))
        let baseline = layout.plotBottom + LessonPlotLayout.tickOffset
        context.draw(
          number,
          in: CGRect(
            origin: CGPoint(
              x: tick.center - size.width / 2, y: baseline - number.firstBaseline(in: size)),
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
    let groupsX = LessonPlotTicks.isLarge(plot.series.flatMap(\.points).map(\.x))
    let x = { (value: Double) in
      ActivityNumberFormat.format(value, unit: plot.xUnit, grouping: groupsX)
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

extension GraphicsContext {
  /// A point's name on a halo in the card's color, so it stays readable where it crosses a line.
  fileprivate func drawName(_ label: LessonPlotLayout.Label, font: UIFont) {
    let card = UIColor(cgColor: Color.card.resolve(in: environment).cgColor)
    let ink = UIColor(cgColor: Color(.foreground).resolve(in: environment).cgColor)
    let halo = NSAttributedString(
      string: label.text,
      attributes: [
        .font: font, .strokeColor: card,
        .strokeWidth: LessonPlotLayout.haloWidth / font.pointSize * 100,
      ])
    let fill = NSAttributedString(
      string: label.text, attributes: [.font: font, .foregroundColor: ink])
    let size = fill.size()
    let start =
      switch label.anchor {
      case .start: label.x
      case .middle: label.x - size.width / 2
      case .end: label.x - size.width
      }
    let origin = CGPoint(x: start, y: label.y - size.height / 2)

    withCGContext { context in
      UIGraphicsPushContext(context)
      context.setLineJoin(.round)
      halo.draw(at: origin)
      fill.draw(at: origin)
      UIGraphicsPopContext()
    }
  }
}

extension UIFont {
  fileprivate var monospacedDigits: UIFont {
    UIFont(
      descriptor: fontDescriptor.addingAttributes([
        .featureSettings: [
          [
            UIFontDescriptor.FeatureKey.type: kNumberSpacingType,
            .selector: kMonospacedNumbersSelector,
          ]
        ]
      ]), size: 0)
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
