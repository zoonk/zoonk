import SwiftUI

/// Drag the corners of a shape and watch what always stays true (main's `GeometryBoardActivity`):
/// the angles' sum, a² + b² = c² on a right triangle, or an area. Measures are rounded so the parts
/// on screen add up to the total on screen. With a numeric check the total stays hidden until
/// checked: the learner works it out from the parts.
struct GeometryBoardCanvas: View {
  let context: ActivityCanvasContext
  let fields: GeometryBoardFields

  @State private var points: [GeometryBoardFields.Point]

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
      .focusable(!isChecked)
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

  private static let squareColors: [Color] = [.mint, .purple, .orange]

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
        let color =
          index == reading.totalIndex
          ? Color.orange : (reading.partIndexes.firstIndex(of: index) == 0 ? Color.mint : .purple)
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
        let inside = CGPoint(x: at.x - unitOut.0 * 26, y: at.y + unitOut.1 * 26)
        canvas.draw(
          canvas.resolve(
            Text(verbatim: ActivityNumberFormat.format(reading.parts[index], unit: "°")).font(
              .caption2.weight(.semibold).monospacedDigit())), at: inside)
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
      let parts = reading.parts.map { ActivityNumberFormat.format($0, unit: unit) }.joined(
        separator: " + ")
      ChartsReadout(text: "\(parts) = \(total)", style: isAnswer ? .success : .primary)
        .minimumScaleFactor(0.6)
        .lineLimit(2)
    }
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
