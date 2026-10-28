import Charts
import SwiftUI

struct UnitCircleFields: Decodable, Hashable, Sendable {
  enum AngleUnit: String, Decodable, Sendable {
    case degrees, radians
  }

  enum Trig: String, Decodable, Hashable, Sendable, CaseIterable {
    case sin, cos, tan
  }

  let angleUnit: AngleUnit
  let frame: String
  let show: [Trig]
  let startAngle: Double

  func degrees(_ angle: Double) -> Double {
    angleUnit == .degrees ? angle : angle * 180 / .pi
  }

  /// Core's value at an angle in degrees; nil for a tangent that doesn't exist or a value the
  /// lesson doesn't show.
  func value(_ trig: Trig, degrees: Double) -> Double? {
    guard show.contains(trig) else {
      return nil
    }

    let radians = degrees * .pi / 180

    switch trig {
    case .sin: return sin(radians)
    case .cos: return cos(radians)
    case .tan: return abs(cos(radians)) < 1e-9 ? nil : tan(radians)
    }
  }
}

/// Mirrors main's `unit-circle-angle.ts`.
enum UnitCircleAngle {
  /// 5° when every angle the lesson names sits on it (so the check's angle can be reached), else 1°
  /// or half a degree.
  static func step(_ angles: [Double]) -> Double {
    [5.0, 1].first { step in
      angles.allSatisfy { abs($0 / step - ChartsMath.jsRound($0 / step)) < 1e-3 }
    } ?? 0.5
  }

  static func snap(_ degrees: Double, step: Double) -> Double {
    ChartsMath.snap(degrees, min: 0, max: 360, step: step)
  }

  /// A multiple of π people write, like "5π/6"; nil otherwise.
  static func piFraction(_ degrees: Double) -> String? {
    let turns = degrees / 180

    guard
      let denominator = [1, 2, 3, 4, 6, 12].first(where: { candidate in
        abs(turns * Double(candidate) - ChartsMath.jsRound(turns * Double(candidate))) < 1e-6
      })
    else {
      return nil
    }

    let numerator = Int(ChartsMath.jsRound(turns * Double(denominator)))

    if numerator == 0 {
      return "0"
    }

    let top = numerator == 1 ? "π" : "\(numerator)π"
    return denominator == 1 ? top : "\(top)/\(denominator)"
  }
}

/// With a numeric check, the value the check reads at the point's angle is the answer.
struct UnitCircleCanvas: View {
  let context: ActivityCanvasContext
  let fields: UnitCircleFields

  @State private var degrees: Double

  init(context: ActivityCanvasContext, fields: UnitCircleFields) {
    self.context = context
    self.fields = fields
    let target = Self.target(context.check, fields: fields)
    let start = fields.degrees(fields.startAngle)
    let step = UnitCircleAngle.step(target.map { [start, $0.degrees] } ?? [start])
    _degrees = State(initialValue: UnitCircleAngle.snap(start, step: step))
  }

  private static func target(_ check: ActivityCheck?, fields: UnitCircleFields)
    -> (degrees: Double, output: UnitCircleFields.Trig)?
  {
    guard case .numeric(_, _, _, _, _, let inputs, let output) = check,
      let trig = fields.show.first(where: { $0.rawValue == output }) ?? fields.show.first
    else {
      return nil
    }

    let angle = inputs?.first { $0.name == "angle" }?.value ?? fields.startAngle
    return (fields.degrees(angle), trig)
  }

  private var target: (degrees: Double, output: UnitCircleFields.Trig)? {
    Self.target(context.check, fields: fields)
  }

  private var step: Double {
    let start = fields.degrees(fields.startAngle)
    return UnitCircleAngle.step(target.map { [start, $0.degrees] } ?? [start])
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private func angleText(_ degrees: Double) -> String {
    if fields.angleUnit == .degrees {
      return ActivityNumberFormat.format(degrees, unit: "°")
    }

    return UnitCircleAngle.piFraction(degrees)
      ?? String(
        localized: "\(ActivityNumberFormat.format(degrees * .pi / 180)) rad",
        table: "ActivitiesCharts",
        comment: "An angle in radians, like 2.5 rad")
  }

  private func trigName(_ trig: UnitCircleFields.Trig) -> String {
    switch trig {
    case .sin:
      String(
        localized: "sin", table: "ActivitiesCharts",
        comment: "Short name of sine (sen in Portuguese and Spanish)")
    case .cos: String(localized: "cos", table: "ActivitiesCharts", comment: "Short name of cosine")
    case .tan: String(localized: "tan", table: "ActivitiesCharts", comment: "Short name of tangent")
    }
  }

  private func valueText(_ value: Double?) -> String {
    value.map { ActivityNumberFormat.format($0, digits: 2) }
      ?? String(
        localized: "undefined", table: "ActivitiesCharts",
        comment: "A tangent that doesn't exist, at 90°")
  }

  private static func color(_ trig: UnitCircleFields.Trig) -> Color {
    switch trig {
    case .sin: .orange
    case .cos: .purple
    case .tan: .mint
    }
  }

  private var valueList: String {
    fields.show.map { "\(trigName($0)) = \(valueText(fields.value($0, degrees: degrees)))" }
      .joined(separator: ", ")
  }

  var body: some View {
    ChartsCanvas {
      LessonRichText(fields.frame)
        .font(.subheadline)
        .foregroundStyle(.secondary)

      HStack(spacing: 16) {
        Text(verbatim: angleText(degrees))
          .font(.title2.weight(.semibold).monospacedDigit())
        ForEach(fields.show, id: \.self) { trig in
          Text(verbatim: "\(trigName(trig)) \(valueText(fields.value(trig, degrees: degrees)))")
            .font(.subheadline.weight(.medium).monospacedDigit())
            .foregroundStyle(Self.color(trig))
        }
      }
      .accessibilityHidden(true)

      dial
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text(verbatim: summary))

      if fields.show.contains(where: { $0 != .tan }) {
        Text(
          "As the point turns", tableName: "ActivitiesCharts",
          comment: "Above the sine and cosine waves"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
        waves
      }
    }
  }

  private var dial: some View {
    GeometryReader { geometry in
      let side = min(geometry.size.width, geometry.size.height)
      let radius = side / 2 - 28
      let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
      let point = position(degrees, center: center, radius: radius)

      ZStack {
        Canvas { canvas, _ in
          draw(in: &canvas, center: center, radius: radius)
        }
        .contentShape(.rect)
        .gesture(
          SpatialTapGesture(coordinateSpace: .named(ChartsPlot.space)).onEnded { tap in
            turn(to: angle(of: tap.location, center: center))
          },
          isEnabled: !isChecked)

        ChartsHandle(isEnabled: !isChecked)
          .chartsAdjustable(
            label: Text(
              "Point on the circle", tableName: "ActivitiesCharts",
              comment: "The unit circle's point, for VoiceOver"),
            value: "\(angleText(degrees)). \(valueList)", isEnabled: !isChecked
          ) { steps in
            turn(to: degrees + Double(steps) * (abs(steps) > 1 ? 45 / 10 : step))
          }
          .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
              .onChanged { turn(to: angle(of: $0.location, center: center)) },
            isEnabled: !isChecked
          )
          .position(point)
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .aspectRatio(1, contentMode: .fit)
    .frame(maxWidth: 360)
    .frame(maxWidth: .infinity)
  }

  private func position(_ degrees: Double, center: CGPoint, radius: CGFloat) -> CGPoint {
    let radians = degrees * .pi / 180
    return CGPoint(x: center.x + radius * cos(radians), y: center.y - radius * sin(radians))
  }

  /// The angle of a screen point around the center, counterclockwise from the right like on paper.
  private func angle(of point: CGPoint, center: CGPoint) -> Double {
    let degrees = atan2(center.y - point.y, point.x - center.x) * 180 / .pi
    return degrees < 0 ? degrees + 360 : degrees
  }

  private func turn(to raw: Double) {
    let next = UnitCircleAngle.snap(raw, step: step)

    guard next != degrees else {
      return
    }

    degrees = next

    if let target {
      context.setAnswer(fields.value(target.output, degrees: next).map { .numeric($0) })
    }
  }

  private func draw(in canvas: inout GraphicsContext, center: CGPoint, radius: CGFloat) {
    let point = position(degrees, center: center, radius: radius)
    let line = { (from: CGPoint, to: CGPoint) in
      Path {
        $0.move(to: from)
        $0.addLine(to: to)
      }
    }

    canvas.stroke(
      line(
        CGPoint(x: center.x - radius - 12, y: center.y),
        CGPoint(x: center.x + radius + 12, y: center.y)), with: .style(Color(.separator)),
      lineWidth: 1.5)
    canvas.stroke(
      line(
        CGPoint(x: center.x, y: center.y - radius - 12),
        CGPoint(x: center.x, y: center.y + radius + 12)), with: .style(Color(.separator)),
      lineWidth: 1.5)
    canvas.stroke(
      Path(
        ellipseIn: CGRect(
          x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)),
      with: .style(.secondary), lineWidth: 1.5)

    canvas.stroke(
      Path { path in
        path.addArc(
          center: center, radius: 22, startAngle: .zero, endAngle: .degrees(-degrees),
          clockwise: true)
      }, with: .style(.secondary), lineWidth: 1.5)

    canvas.stroke(line(center, point), with: .style(.primary), lineWidth: 2)

    if fields.show.contains(.cos) {
      canvas.stroke(
        line(center, CGPoint(x: point.x, y: center.y)), with: .style(Color.purple),
        style: StrokeStyle(lineWidth: 4, lineCap: .round))
    }

    if fields.show.contains(.sin) {
      canvas.stroke(
        line(CGPoint(x: point.x, y: center.y), point), with: .style(Color.orange),
        style: StrokeStyle(lineWidth: 4, lineCap: .round))
    }

    if fields.show.contains(.tan), let tangent = fields.value(.tan, degrees: degrees),
      abs(tangent) < 4
    {
      let foot = CGPoint(x: center.x + radius, y: center.y)
      let top = CGPoint(x: foot.x, y: center.y - radius * tangent)
      canvas.stroke(
        line(foot, top), with: .style(Color.mint), style: StrokeStyle(lineWidth: 4, lineCap: .round)
      )
      canvas.stroke(
        line(center, top), with: .style(Color.mint.opacity(0.6)),
        style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
    }

    if isChecked, let target {
      let mark = position(target.degrees, center: center, radius: radius)
      canvas.stroke(
        Path(ellipseIn: CGRect(x: mark.x - 12, y: mark.y - 12, width: 24, height: 24)),
        with: .style(Color.success), lineWidth: 3)
      let label = canvas.resolve(
        Text(verbatim: angleText(target.degrees)).font(.caption.weight(.semibold)).foregroundStyle(
          Color.success))
      canvas.draw(label, at: CGPoint(x: mark.x, y: mark.y - 22))
    }
  }

  private var waves: some View {
    Chart {
      ForEach(fields.show.filter { $0 != .tan }, id: \.self) { trig in
        ForEach(Array(stride(from: 0.0, through: 360, by: 5)), id: \.self) { x in
          LineMark(
            x: .value("angle", x), y: .value("value", fields.value(trig, degrees: x) ?? 0),
            series: .value("wave", trig.rawValue)
          )
          .foregroundStyle(Self.color(trig))
        }

        PointMark(
          x: .value("angle", degrees), y: .value("value", fields.value(trig, degrees: degrees) ?? 0)
        )
        .foregroundStyle(Self.color(trig))
        .symbolSize(60)
      }

      RuleMark(x: .value("angle", degrees))
        .foregroundStyle(.secondary.opacity(0.5))
        .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [2, 4]))
    }
    .chartXScale(domain: 0...360)
    .chartYScale(domain: -1...1)
    .chartXAxis {
      AxisMarks(values: [0, 90, 180, 270, 360]) { value in
        AxisGridLine()
        AxisValueLabel {
          if let x = value.as(Double.self) {
            Text(verbatim: angleText(x))
          }
        }
      }
    }
    .chartYAxis {
      AxisMarks(values: [-1, 0, 1]) { value in
        AxisGridLine()
        AxisValueLabel {
          if let y = value.as(Double.self) {
            Text(verbatim: ActivityNumberFormat.format(y))
          }
        }
      }
    }
    .frame(minHeight: 140)
    .accessibilityHidden(true)
  }

  private var summary: String {
    var text = String(
      localized:
        "A circle of radius 1 with a point at \(angleText(degrees)). Its height is the sine and its sideways distance from the center is the cosine: \(valueList).",
      table: "ActivitiesCharts", comment: "The unit circle, for VoiceOver")

    if isChecked, let target, case .numeric(_, let answer, _, _, _, _, _) = context.check {
      text +=
        " "
        + String(
          localized:
            "The question asks about \(angleText(target.degrees)), where \(trigName(target.output)) = \(valueText(answer)).",
          table: "ActivitiesCharts", comment: "The checked angle on a unit circle, for VoiceOver")
    }

    return text
  }
}
