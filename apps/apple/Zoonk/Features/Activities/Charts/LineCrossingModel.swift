import Foundation

struct LineCrossingFields: Decodable, Hashable, Sendable {
  struct Line: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let intercept: Double
    let slope: Double
  }

  enum Direction: String, Codable, Hashable, Sendable {
    case left, right, up, down
  }

  struct Shift: Decodable, Hashable, Sendable {
    let amount: Double
    let direction: Direction
    let line: String
  }

  struct Feedback: Decodable, Hashable, Sendable {
    let wrongDirection: String
    let wrongLine: String
  }

  let change: String
  let feedback: Feedback
  let lines: [Line]
  let shift: Shift
  let xLabel: String
  let yLabel: String
}

/// The interaction answer: which line moved and which way (core's `curveShift`).
struct LineShiftAnswer: Codable, Hashable, Sendable {
  var kind = "curveShift"
  let curve: String
  let direction: LineCrossingFields.Direction
}

/// Main's `line-crossing-model.ts` and core's `shiftLine`/`crossing`: lines y = a + b·x, moved
/// sideways or up and down, and where they cross.
enum LineCrossingModel {
  struct Line: Hashable {
    var intercept: Double
    var slope: Double

    func y(at x: Double) -> Double { intercept + slope * x }
  }

  struct Point: Hashable {
    let x: Double
    let y: Double
  }

  enum Axis {
    case horizontal, vertical
  }

  static func axis(of direction: LineCrossingFields.Direction) -> Axis {
    direction == .left || direction == .right ? .horizontal : .vertical
  }

  static func direction(of offset: Double, axis: Axis) -> LineCrossingFields.Direction {
    switch axis {
    case .horizontal: offset > 0 ? .right : .left
    case .vertical: offset > 0 ? .up : .down
    }
  }

  /// Right means each y goes with more x; up means each x goes with more y, as core moves them.
  static func moved(_ line: Line, by offset: Double, axis: Axis) -> Line {
    guard offset != 0 else {
      return line
    }

    switch axis {
    case .vertical:
      return Line(intercept: line.intercept + offset, slope: line.slope)
    case .horizontal:
      return Line(intercept: line.intercept - line.slope * offset, slope: line.slope)
    }
  }

  /// Where two lines cross; the origin when they never do (validation keeps them crossing).
  static func crossing(_ first: Line, _ second: Line) -> Point {
    guard !ChartsMath.isClose(first.slope, second.slope) else {
      return Point(x: 0, y: 0)
    }

    let x = (second.intercept - first.intercept) / (first.slope - second.slope)
    return Point(x: x, y: first.y(at: x))
  }

  static func line(_ field: LineCrossingFields.Line) -> Line {
    Line(intercept: field.intercept, slope: field.slope)
  }

  /// How far a line can be dragged: twice the real shift each way, in quarter steps of it.
  static func range(_ amount: Double) -> (min: Double, max: Double, step: Double) {
    (-amount * 2, amount * 2, amount / 4)
  }

  /// Axes that fit the crossing for every position either line can be dragged to, with room.
  static func domain(_ fields: LineCrossingFields) -> Point {
    let axis = axis(of: fields.shift.direction)
    let reach = range(fields.shift.amount).max
    let lines = fields.lines.map(line)

    guard lines.count == 2 else {
      return Point(x: 1, y: 1)
    }

    let points = [-reach, 0, reach].flatMap { offset in
      [
        crossing(moved(lines[0], by: offset, axis: axis), lines[1]),
        crossing(lines[0], moved(lines[1], by: offset, axis: axis)),
      ]
    }

    let x = max(points.map(\.x).max() ?? 1, 1)
    let y = max(points.map(\.y).max() ?? 1, lines.map(\.intercept).max() ?? 1, 1)

    return Point(x: x * 1.25, y: y * 1.25)
  }

  /// The line's stretch inside the box from zero to the domain on both axes.
  static func segment(_ line: Line, domain: Point) -> (from: Point, to: Point) {
    guard line.slope != 0 else {
      return (Point(x: 0, y: line.intercept), Point(x: domain.x, y: line.intercept))
    }

    let atBottom = -line.intercept / line.slope
    let atTop = (domain.y - line.intercept) / line.slope
    let from = max(0, min(atBottom, atTop))
    let to = min(domain.x, max(atBottom, atTop))
    let (start, end) = from <= to ? (from, to) : (0, 0)

    return (Point(x: start, y: line.y(at: start)), Point(x: end, y: line.y(at: end)))
  }

  enum Change {
    case up, down, same
  }

  static func change(_ before: Double, _ after: Double) -> Change {
    let slack = max(abs(before), 1) * 1e-9

    if abs(after - before) <= slack {
      return .same
    }

    return after > before ? .up : .down
  }

  /// Core's grading of the interaction: the right line moved the right way.
  static func grade(_ fields: LineCrossingFields, _ answer: ActivityAnswer) -> Bool {
    guard let shift = try? answer.decode(as: LineShiftAnswer.self) else {
      return false
    }

    return shift.kind == "curveShift" && shift.curve == fields.shift.line
      && shift.direction == fields.shift.direction
  }
}
