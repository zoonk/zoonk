import SwiftUI

/// Drag the corners of a shape and watch what always stays true (main's `GeometryBoardActivity`):
/// the angles' sum, a² + b² = c² on a right triangle, or an area. Measures are rounded so the parts
/// on screen add up to the total on screen. With a numeric check the total stays hidden until
/// checked: the learner works it out from the parts.
struct GeometryBoardCanvas: View {
  let context: ActivityCanvasContext
  let fields: GeometryBoardFields

  @State private var points: [GeometryBoardFields.Point]
  @FocusState private var focusedCorner: Int?

  init(context: ActivityCanvasContext, fields: GeometryBoardFields) {
    self.context = context
    self.fields = fields
    _points = State(initialValue: fields.points)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var hidesTotal: Bool {
    if case .numeric = context.check, !isChecked { return true }
    return false
  }

  private var step: Double { GeometryBoardModel.gridStep(fields.points) }

  private var bounds: GeometryBoardModel.Bounds {
    GeometryBoardModel.bounds(fields.points, measure: fields.measure, step: step)
  }

  private var unit: String? { fields.measure == .angleSum ? "°" : nil }

  var body: some View {
    let reading = GeometryBoardModel.read(points, measure: fields.measure)
    let summary = describe(reading)

    ChartsCanvas {
      board(reading: reading, summary: summary)

      Text(
        "Drag a corner to move it one grid step at a time.", tableName: "ActivitiesCharts",
        comment: "How to use a geometry board"
      )
      .font(.footnote)
      .foregroundStyle(.secondary)

      sumLine(reading)
        .accessibilityHidden(true)

      if !isChecked && points != fields.points {
        Button {
          points = fields.points
        } label: {
          Label {
            Text(
              "Back to the start", tableName: "ActivitiesCharts",
              comment: "Puts a shape's corners back")
          } icon: {
            Image(systemName: "arrow.counterclockwise")
          }
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      }

      if isChecked {
        LessonRichText(fields.invariant)
          .font(.subheadline.weight(.medium))
      }
    }
  }

  private func board(reading: GeometryBoardModel.Reading, summary: String) -> some View {
    GeometryReader { geometry in
      let transform = BoardTransform(bounds: bounds, size: geometry.size)

      ZStack {
        Canvas { canvas, _ in
          draw(in: &canvas, transform: transform, reading: reading)
        }
        .accessibilityElement()
        .accessibilityLabel(
          Text(
            "A shape with \(points.count) corners on a grid. \(points.filter(\.movable).count) corners move.",
            tableName: "ActivitiesCharts", comment: "A geometry board, for VoiceOver")
        )
        .accessibilityValue(Text(verbatim: summary))

        ForEach(points.indices, id: \.self) { index in
          if points[index].movable {
            corner(index, transform: transform, summary: summary)
          }
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .aspectRatio(
      CGFloat((bounds.maxX - bounds.minX) / max(bounds.maxY - bounds.minY, 1e-9)), contentMode: .fit
    )
    .frame(maxHeight: 340)
    .frame(maxWidth: .infinity)
  }

  private func cornerName(_ index: Int) -> String {
    points[index].label ?? String(UnicodeScalar(UInt8(65 + index)))
  }

  private func corner(_ index: Int, transform: BoardTransform, summary: String) -> some View {
    let point = points[index]
    let moves: [(name: Text, offset: (Double, Double))] = [
      (
        Text("Move left", tableName: "ActivitiesCharts", comment: "Moves a corner left"), (-step, 0)
      ),
      (
        Text("Move right", tableName: "ActivitiesCharts", comment: "Moves a corner right"),
        (step, 0)
      ),
      (Text("Move up", tableName: "ActivitiesCharts", comment: "Moves a corner up"), (0, step)),
      (
        Text("Move down", tableName: "ActivitiesCharts", comment: "Moves a corner down"), (0, -step)
      ),
    ].filter { move in
      switch point.track {
      case .horizontal: move.offset.1 == 0
      case .vertical: move.offset.0 == 0
      case nil: true
      }
    }

    return ChartsHandle(tint: .mint, isEnabled: !isChecked)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(
        Text(
          "Corner \(cornerName(index))", tableName: "ActivitiesCharts",
          comment: "A movable corner, like Corner A")
      )
      .accessibilityValue(
        Text(
          "At \(ActivityNumberFormat.format(point.x)), \(ActivityNumberFormat.format(point.y)). \(summary)",
          tableName: "ActivitiesCharts",
          comment: "Where a corner is and what the board measures")
      )
      .accessibilityActions {
        ForEach(Array(moves.enumerated()), id: \.offset) { _, move in
          Button {
            moveBy(index, move.offset)
          } label: {
            move.name
          }
        }
      }
      .focusable(!isChecked, interactions: .edit)
      .focused($focusedCorner, equals: index)
      // Touching or clicking a corner gives it the keyboard, as on the web.
      .simultaneousGesture(
        DragGesture(minimumDistance: 0).onChanged { _ in
          if focusedCorner != index { focusedCorner = index }
        }, isEnabled: !isChecked
      )
      .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow]) { press in
        guard !isChecked else { return .ignored }
        var offset: (Double, Double) =
          switch press.key {
          case .leftArrow: (-step, 0)
          case .rightArrow: (step, 0)
          case .upArrow: (0, step)
          default: (0, -step)
          }
        // On a track, any arrow slides the corner along it.
        if let track = point.track {
          let amount = offset.0 + offset.1
          offset = track == .horizontal ? (amount, 0) : (0, amount)
        }
        moveBy(index, offset)
        return .handled
      }
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
          .onChanged { drag in moveTo(index, transform.value(drag.location)) },
        isEnabled: !isChecked
      )
      .position(transform.point(point.x, point.y))
  }

  private func moveTo(_ index: Int, _ target: (x: Double, y: Double)) {
    let next = GeometryBoardModel.move(
      points, index: index, to: target, bounds: bounds, measure: fields.measure,
      minArea: GeometryBoardModel.area(fields.points) * 0.05, step: step)

    if let next, next != points {
      points = next
    }
  }

  private func moveBy(_ index: Int, _ offset: (Double, Double)) {
    moveTo(index, (points[index].x + offset.0, points[index].y + offset.1))
  }

  static func color(_ tone: GeometryBoardModel.Tone) -> Color {
    switch tone {
    case .accent: .mint
    case .highlight: .orange
    case .secondary: .purple
    case .neutral: .secondary
    }
  }

  /// The color a part of the sum has on the board, so the numbers match the marks.
  private func partColor(_ index: Int, reading: GeometryBoardModel.Reading) -> Color {
    switch fields.measure {
    case .angleSum:
      Self.color(GeometryBoardModel.cornerTone(index, count: reading.parts.count))
    case .pythagoras:
      Self.color(
        GeometryBoardModel.squareTone(
          reading.partIndexes.indices.contains(index) ? reading.partIndexes[index] : index,
          totalIndex: reading.totalIndex))
    default:
      .primary
    }
  }

  private func draw(
    in canvas: inout GraphicsContext, transform: BoardTransform, reading: GeometryBoardModel.Reading
  ) {
    let grid = Path { path in
      for x in stride(from: bounds.minX, through: bounds.maxX + 1e-9, by: step) {
        path.move(to: transform.point(x, bounds.minY))
        path.addLine(to: transform.point(x, bounds.maxY))
      }
      for y in stride(from: bounds.minY, through: bounds.maxY + 1e-9, by: step) {
        path.move(to: transform.point(bounds.minX, y))
        path.addLine(to: transform.point(bounds.maxX, y))
      }
    }
    canvas.stroke(grid, with: .style(Color(.separator).opacity(0.5)), lineWidth: 0.5)

    if fields.measure == .pythagoras {
      for (index, square) in GeometryBoardModel.sideSquares(points).enumerated() {
        let path = Path { path in
          path.addLines(square.map { transform.point($0.x, $0.y) })
          path.closeSubpath()
        }
        let color = Self.color(GeometryBoardModel.squareTone(index, totalIndex: reading.totalIndex))
        canvas.fill(path, with: .style(color.opacity(0.15)))
        canvas.stroke(path, with: .style(color), lineWidth: 1.5)

        let center = square.reduce((0.0, 0.0)) { ($0.0 + $1.x / 4, $0.1 + $1.y / 4) }
        let value =
          index == reading.totalIndex
          ? reading.total : reading.partIndexes.firstIndex(of: index).map { reading.parts[$0] }
        if let value {
          let text =
            index == reading.totalIndex && hidesTotal ? "?" : ActivityNumberFormat.format(value)
          canvas.draw(
            canvas.resolve(
              Text(verbatim: text).font(.caption.weight(.semibold)).foregroundStyle(color)),
            at: transform.point(center.0, center.1))
        }
      }
    }

    let shape = Path { path in
      path.addLines(points.map { transform.point($0.x, $0.y) })
      path.closeSubpath()
    }
    canvas.fill(shape, with: .style(Color.mint.opacity(fields.measure == .area ? 0.25 : 0.12)))
    canvas.stroke(shape, with: .style(.primary), lineWidth: 2)

    let angles = GeometryBoardModel.interiorAngles(points)
    let centroid = (
      points.map(\.x).reduce(0, +) / Double(points.count),
      points.map(\.y).reduce(0, +) / Double(points.count)
    )

    for (index, point) in points.enumerated() {
      let at = transform.point(point.x, point.y)

      if !point.movable {
        canvas.fill(
          Path(ellipseIn: CGRect(x: at.x - 5, y: at.y - 5, width: 10, height: 10)),
          with: .style(.primary))
      }

      // Corner names sit outside the shape, angles inside it.
      let outward = (point.x - centroid.0, point.y - centroid.1)
      let length = max(hypot(outward.0, outward.1), 1e-9)
      let unitOut = (outward.0 / length, outward.1 / length)
      let name = CGPoint(x: at.x + unitOut.0 * 22, y: at.y - unitOut.1 * 22)
      canvas.draw(
        canvas.resolve(
          Text(verbatim: cornerName(index)).font(.caption.weight(.semibold)).foregroundStyle(
            .secondary)), at: name)

      if fields.measure == .angleSum, index < reading.parts.count {
        let previous = transform.point(
          points[(index - 1 + points.count) % points.count].x,
          points[(index - 1 + points.count) % points.count].y)
        let next = transform.point(
          points[(index + 1) % points.count].x, points[(index + 1) % points.count].y)
        let shortest = min(
          hypot(previous.x - at.x, previous.y - at.y), hypot(next.x - at.x, next.y - at.y))
        let wedge = GeometryBoardModel.cornerWedge(
          angle: angles[index], corner: at, next: next, previous: previous,
          radius: max(min(26, shortest * 0.35), 12))
        let color = partColor(index, reading: reading)
        let path = Path { path in
          path.move(to: at)
          path.addLines(wedge.points)
          path.closeSubpath()
        }
        canvas.fill(path, with: .style(color.opacity(0.18)))
        canvas.stroke(path, with: .style(color), lineWidth: 1.5)
        canvas.draw(
          canvas.resolve(
            Text(verbatim: ActivityNumberFormat.format(reading.parts[index], unit: "°"))
              .font(.caption2.weight(.semibold).monospacedDigit()).foregroundStyle(color)),
          at: wedge.label)
      }

      if fields.measure == .perimeter, index < reading.parts.count {
        let next = points[(index + 1) % points.count]
        let middle = transform.point((point.x + next.x) / 2, (point.y + next.y) / 2)
        canvas.draw(
          canvas.resolve(
            Text(verbatim: ActivityNumberFormat.format(reading.parts[index])).font(
              .caption2.weight(.semibold).monospacedDigit()
            ).foregroundStyle(.purple)), at: middle)
      }
    }
  }

  @ViewBuilder
  private func sumLine(_ reading: GeometryBoardModel.Reading) -> some View {
    let total = hidesTotal ? "?" : ActivityNumberFormat.format(reading.total, unit: unit)
    let isAnswer =
      isChecked
      && {
        if case .numeric = context.check { return true }
        return false
      }()

    if fields.measure == .area {
      HStack(alignment: .firstTextBaseline) {
        Text("Area", tableName: "ActivitiesCharts", comment: "Label of a shape's area")
          .foregroundStyle(.secondary)
        ChartsReadout(text: total, style: isAnswer ? .success : .primary)
      }
    } else {
      VStack(alignment: .leading, spacing: 12) {
        if fields.measure == .angleSum && !hidesTotal && reading.parts.count <= 4 {
          AngleFan(
            angles: reading.parts,
            colors: reading.parts.indices.map { partColor($0, reading: reading) })
        }

        Text(sumText(reading, total: total, isAnswer: isAnswer))
          .font(.title2.weight(.semibold).monospacedDigit())
          .minimumScaleFactor(0.6)
          .lineLimit(2)
      }
    }
  }

  /// "45° + 72° + 63° = 180°", each part in its mark's color.
  private func sumText(_ reading: GeometryBoardModel.Reading, total: String, isAnswer: Bool)
    -> AttributedString
  {
    var sum = reading.parts.indices.reduce(into: AttributedString()) { sum, index in
      var part = AttributedString(ActivityNumberFormat.format(reading.parts[index], unit: unit))
      part.foregroundColor = partColor(index, reading: reading)
      sum += index == 0 ? part : AttributedString(" + ") + part
    }
    var totalText = AttributedString(total)
    totalText.foregroundColor =
      isAnswer ? Color.success : fields.measure == .pythagoras ? Color.orange : .primary
    sum += AttributedString(" = ") + totalText
    return sum
  }

  /// What the board measures now, in words, for VoiceOver.
  private func describe(_ reading: GeometryBoardModel.Reading) -> String {
    let parts = reading.parts.map { ActivityNumberFormat.format($0, unit: unit) }.joined(
      separator: ", ")
    let total = ActivityNumberFormat.format(reading.total, unit: unit)

    switch fields.measure {
    case .angleSum:
      return hidesTotal
        ? String(
          localized: "Angles: \(parts).", table: "ActivitiesCharts", comment: "For VoiceOver")
        : String(
          localized: "Angles: \(parts), adding up to \(total).", table: "ActivitiesCharts",
          comment: "For VoiceOver")
    case .perimeter:
      return hidesTotal
        ? String(localized: "Sides: \(parts).", table: "ActivitiesCharts", comment: "For VoiceOver")
        : String(
          localized: "Sides: \(parts), adding up to a perimeter of \(total).",
          table: "ActivitiesCharts", comment: "For VoiceOver")
    case .area:
      return hidesTotal
        ? ""
        : String(localized: "Area: \(total).", table: "ActivitiesCharts", comment: "For VoiceOver")
    case .pythagoras:
      return hidesTotal
        ? String(
          localized: "Squares on the two shorter sides: \(parts).", table: "ActivitiesCharts",
          comment: "For VoiceOver")
        : String(
          localized:
            "Squares on the two shorter sides: \(parts). Square on the longest side: \(total).",
          table: "ActivitiesCharts", comment: "For VoiceOver")
    }
  }
}

/// Board units to points: the bounds fit the view with padding, y pointing up.
private struct BoardTransform {
  let bounds: GeometryBoardModel.Bounds
  let size: CGSize
  private let padding: CGFloat = 20

  private var scale: CGFloat {
    min(
      (size.width - padding * 2) / CGFloat(bounds.maxX - bounds.minX),
      (size.height - padding * 2) / CGFloat(bounds.maxY - bounds.minY))
  }

  private var origin: CGPoint {
    CGPoint(
      x: (size.width - CGFloat(bounds.maxX - bounds.minX) * scale) / 2,
      y: (size.height - CGFloat(bounds.maxY - bounds.minY) * scale) / 2)
  }

  func point(_ x: Double, _ y: Double) -> CGPoint {
    CGPoint(
      x: origin.x + CGFloat(x - bounds.minX) * scale,
      y: origin.y + CGFloat(bounds.maxY - y) * scale)
  }

  func value(_ point: CGPoint) -> (x: Double, y: Double) {
    (
      bounds.minX + Double((point.x - origin.x) / scale),
      bounds.maxY - Double((point.y - origin.y) / scale)
    )
  }
}

/// The corners torn off and laid side by side around one point (main's `AngleFan`): a triangle's
/// angles fill a straight line, a quadrilateral's a full turn. It shows why the sum never changes.
private struct AngleFan: View {
  let angles: [Double]
  let colors: [Color]

  private var isTriangle: Bool { angles.count == 3 }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(
        "Tear off the corners and put them side by side", tableName: "ActivitiesCharts",
        comment: "Above a geometry board's corners laid side by side"
      )
      .font(.footnote)
      .foregroundStyle(.secondary)

      HStack(alignment: .bottom, spacing: 12) {
        Canvas { canvas, size in
          let radius = 44.0
          let center = CGPoint(x: size.width / 2, y: radius + 6)
          var start = Double.pi

          for (index, angle) in angles.enumerated() {
            let sweep = angle * .pi / 180
            let path = Path { path in
              path.move(to: center)
              path.addLines(
                (0...24).map { step in
                  let direction = start + sweep * Double(step) / 24
                  return CGPoint(
                    x: center.x + radius * cos(direction), y: center.y + radius * sin(direction))
                })
              path.closeSubpath()
            }
            let color = colors.indices.contains(index) ? colors[index] : .secondary
            canvas.fill(path, with: .style(color.opacity(0.18)))
            canvas.stroke(path, with: .style(color), lineWidth: 1.5)
            start += sweep
          }

          if isTriangle {
            let line = Path { path in
              path.move(to: CGPoint(x: 6, y: center.y))
              path.addLine(to: CGPoint(x: size.width - 6, y: center.y))
            }
            canvas.stroke(
              line, with: .style(.primary), style: StrokeStyle(lineWidth: 2, lineCap: .round))
          }
        }
        .frame(width: 180, height: isTriangle ? 56 : 100)

        Group {
          if isTriangle {
            Text(
              "a straight line", tableName: "ActivitiesCharts",
              comment: "What a triangle's angles fill")
          } else {
            Text(
              "a full turn", tableName: "ActivitiesCharts",
              comment: "What a quadrilateral's angles fill")
          }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    }
    .accessibilityHidden(true)
  }
}
