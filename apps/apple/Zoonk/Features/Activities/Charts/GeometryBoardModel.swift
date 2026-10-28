import CoreGraphics
import Foundation

struct GeometryBoardFields: Decodable, Hashable, Sendable {
  enum Measure: String, Decodable, Sendable {
    case angleSum, area, perimeter, pythagoras
  }

  enum Track: String, Decodable, Hashable, Sendable {
    case horizontal, vertical
  }

  struct Point: Decodable, Hashable, Sendable {
    let id: String
    var label: String?
    let movable: Bool
    var track: Track?
    var x: Double
    var y: Double
  }

  let invariant: String
  let measure: Measure
  let points: [Point]
}

/// Main's `board-geometry.ts` and `board-measure.ts`: what a shape measures, the grid its corners
/// snap to, and the moves that keep it a shape the board can measure honestly.
enum GeometryBoardModel {
  typealias Point = GeometryBoardFields.Point

  /// Main's board tones (`board-tones.ts`): what the learner moves, a target, a second series, or
  /// neutral.
  enum Tone: CaseIterable {
    case accent, highlight, secondary, neutral
  }

  /// A tone per corner, so each angle can be matched with its number in the sum. Neighbouring
  /// corners never share one, including the last and the first.
  static func cornerTone(_ index: Int, count: Int) -> Tone {
    let tone = Tone.allCases[index % Tone.allCases.count]
    let wrapsOntoFirst = index == count - 1 && index % Tone.allCases.count == 0 && index > 0
    return wrapsOntoFirst ? .secondary : tone
  }

  /// Pythagoras: the two legs' squares in two tones, the square on the longest side in a third.
  static func squareTone(_ index: Int, totalIndex: Int?) -> Tone {
    if index == totalIndex {
      return .highlight
    }

    return index == 0 || (totalIndex == 0 && index == 1) ? .accent : .secondary
  }

  /// The wedge marking a corner's inside angle on screen (y pointing down), as points around the
  /// corner, and where its label goes: along the middle of the angle, just past the wedge. It turns
  /// from the next side toward the previous one through the inside of the shape.
  static func cornerWedge(
    angle: Double, corner: CGPoint, next: CGPoint, previous: CGPoint, radius: Double
  ) -> (points: [CGPoint], label: CGPoint) {
    let unit = { (to: CGPoint) -> CGPoint in
      let length = max(hypot(to.x - corner.x, to.y - corner.y), 1e-9)
      return CGPoint(x: (to.x - corner.x) / length, y: (to.y - corner.y) / length)
    }
    let (toNext, toPrevious) = (unit(next), unit(previous))
    let from = atan2(toNext.y, toNext.x)
    let shortTurn = atan2(
      toNext.x * toPrevious.y - toNext.y * toPrevious.x,
      toNext.x * toPrevious.x + toNext.y * toPrevious.y)
    // The short way round is the inside for a corner under 180°; a dent goes the long way.
    let direction: Double = shortTurn < 0 ? -1 : 1
    let radians = angle * .pi / 180
    let sweep = angle > 180 ? -direction * radians : direction * radians
    let along = { (direction: Double, distance: Double) in
      CGPoint(x: corner.x + distance * cos(direction), y: corner.y + distance * sin(direction))
    }

    return (
      (0...24).map { along(from + sweep * Double($0) / 24, radius) },
      along(from + sweep / 2, radius + 14)
    )
  }

  struct Bounds: Hashable {
    let minX: Double
    let maxX: Double
    let minY: Double
    let maxY: Double
  }

  struct Reading: Hashable {
    /// What adds up: each corner's angle, each side's length, or the squares on the two legs.
    let parts: [Double]
    let partIndexes: [Int]
    let total: Double
    /// For Pythagoras, the side whose square is the total.
    let totalIndex: Int?
  }

  private static func around<T>(_ items: [T], _ index: Int) -> T {
    items[((index % items.count) + items.count) % items.count]
  }

  private static func cross(_ a: (Double, Double), _ b: (Double, Double)) -> Double {
    a.0 * b.1 - a.1 * b.0
  }

  private static func sub(_ to: Point, _ from: Point) -> (Double, Double) {
    (to.x - from.x, to.y - from.y)
  }

  /// Positive when the corners go counterclockwise (y up).
  static func signedArea(_ points: [Point]) -> Double {
    points.indices.reduce(0) { sum, index in
      let next = around(points, index + 1)
      return sum + points[index].x * next.y - next.x * points[index].y
    } / 2
  }

  static func area(_ points: [Point]) -> Double { abs(signedArea(points)) }

  static func sideLengths(_ points: [Point]) -> [Double] {
    points.indices.map { index in
      let side = sub(around(points, index + 1), points[index])
      return hypot(side.0, side.1)
    }
  }

  /// Each corner's inside angle in degrees, reflex corners included.
  static func interiorAngles(_ points: [Point]) -> [Double] {
    let area = signedArea(points)
    let winding: Double = area > 0 ? 1 : area < 0 ? -1 : 1

    return points.indices.map { index in
      let incoming = sub(points[index], around(points, index - 1))
      let outgoing = sub(around(points, index + 1), points[index])
      let dot = incoming.0 * outgoing.0 + incoming.1 * outgoing.1
      let turn = atan2(cross(incoming, outgoing), dot) * 180 / .pi
      return 180 - winding * turn
    }
  }

  /// Rounds parts so they still add up to their rounded total (largest remainder).
  static func roundParts(_ values: [Double], digits: Int) -> [Double] {
    let scale = pow(10, Double(digits))
    let scaled = values.map { $0 * scale }
    let floors = scaled.map { $0.rounded(.down) }
    let total = ChartsMath.jsRound(scaled.reduce(0, +))
    let missing = Int(total - floors.reduce(0, +))
    let bumped = Set(
      scaled.indices.sorted { first, second in
        let (a, b) = (scaled[first] - floors[first], scaled[second] - floors[second])
        return a != b ? a > b : first < second
      }
      .prefix(max(missing, 0)))

    return floors.indices.map { (floors[$0] + (bumped.contains($0) ? 1 : 0)) / scale }
  }

  static func read(_ points: [Point], measure: GeometryBoardFields.Measure) -> Reading {
    let indexes = Array(points.indices)
    let sum = { (values: [Double]) in ChartsMath.clean(values.reduce(0, +)) }

    switch measure {
    case .angleSum:
      let parts = roundParts(interiorAngles(points), digits: 0)
      return Reading(parts: parts, partIndexes: indexes, total: sum(parts), totalIndex: nil)
    case .perimeter:
      let parts = roundParts(sideLengths(points), digits: 1)
      return Reading(parts: parts, partIndexes: indexes, total: sum(parts), totalIndex: nil)
    case .area:
      return Reading(
        parts: [], partIndexes: [], total: roundParts([area(points)], digits: 2)[0], totalIndex: nil
      )
    case .pythagoras:
      let lengths = sideLengths(points)
      let hypotenuse = lengths.indices.max { lengths[$0] < lengths[$1] } ?? 0
      let squares = lengths.map { $0 * $0 }
      let legs = indexes.filter { $0 != hypotenuse }
      return Reading(
        parts: roundParts(legs.map { squares[$0] }, digits: 2), partIndexes: legs,
        total: roundParts([squares[hypotenuse]], digits: 2)[0], totalIndex: hypotenuse)
    }
  }

  /// The four corners of the square standing outward on each side, for the Pythagoras board.
  static func sideSquares(_ points: [Point]) -> [[(x: Double, y: Double)]] {
    let area = signedArea(points)
    let winding: Double = area > 0 ? 1 : area < 0 ? -1 : 1

    return points.indices.map { index in
      let point = points[index]
      let next = around(points, index + 1)
      let side = sub(next, point)
      let outward = (winding * side.1, -winding * side.0)

      return [
        (point.x, point.y), (next.x, next.y),
        (next.x + outward.0, next.y + outward.1), (point.x + outward.0, point.y + outward.1),
      ]
    }
  }

  /// The largest round step every starting corner sits on, with a few positions across the shape.
  static func gridStep(_ points: [Point]) -> Double {
    let values = points.flatMap { [$0.x, $0.y] }
    let xs = points.map(\.x)
    let ys = points.map(\.y)
    let span = max((xs.max() ?? 0) - (xs.min() ?? 0), (ys.max() ?? 0) - (ys.min() ?? 0))

    return [10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01].first { step in
      span / step >= 4 && values.allSatisfy { ChartsMath.isMultiple($0, of: step) }
    } ?? span / 16
  }

  /// Room to drag around the starting shape (and its squares, for Pythagoras), on the grid.
  static func bounds(_ points: [Point], measure: GeometryBoardFields.Measure, step: Double)
    -> Bounds
  {
    let drawn =
      measure == .pythagoras ? sideSquares(points).flatMap { $0 } : points.map { ($0.x, $0.y) }
    let xs = drawn.map(\.0)
    let ys = drawn.map(\.1)
    let span = max((xs.max() ?? 0) - (xs.min() ?? 0), (ys.max() ?? 0) - (ys.min() ?? 0))
    let margin = max(step, span * (measure == .pythagoras ? 0.1 : 0.25))

    return Bounds(
      minX: (((xs.min() ?? 0) - margin) / step).rounded(.down) * step,
      maxX: (((xs.max() ?? 0) + margin) / step).rounded(.up) * step,
      minY: (((ys.min() ?? 0) - margin) / step).rounded(.down) * step,
      maxY: (((ys.max() ?? 0) + margin) / step).rounded(.up) * step)
  }

  private static func segmentsCross(_ a: (Point, Point), _ b: (Point, Point)) -> Bool {
    let direction = sub(a.1, a.0)
    let other = sub(b.1, b.0)
    let splitsOther = cross(direction, sub(b.0, a.0)) * cross(direction, sub(b.1, a.0)) < 0
    let splitsThis = cross(other, sub(a.0, b.0)) * cross(other, sub(a.1, b.0)) < 0
    return splitsOther && splitsThis
  }

  private static func crossesItself(_ points: [Point]) -> Bool {
    let sides = points.indices.map { (points[$0], around(points, $0 + 1)) }

    return sides.indices.contains { index in
      sides.indices.contains { other in
        other > index + 1 && !(index == 0 && other == sides.count - 1)
          && segmentsCross(sides[index], sides[other])
      }
    }
  }

  /// Inside the board, not flattened, no corner so straight it disappears, no sides crossing.
  static func isValid(
    _ points: [Point], bounds: Bounds, measure: GeometryBoardFields.Measure, minArea: Double
  )
    -> Bool
  {
    let drawn =
      measure == .pythagoras ? sideSquares(points).flatMap { $0 } : points.map { ($0.x, $0.y) }

    return drawn.allSatisfy {
      $0.0 >= bounds.minX && $0.0 <= bounds.maxX && $0.1 >= bounds.minY && $0.1 <= bounds.maxY
    }
      && area(points) >= minArea
      && interiorAngles(points).allSatisfy { $0 >= 3 && abs($0 - 180) >= 3 }
      && !crossesItself(points)
  }

  /// Where a corner lands when moved toward a point: snapped to the grid and kept on its track.
  /// Nil when that spot would break the shape, so the corner stays where it was.
  static func move(
    _ points: [Point], index: Int, to target: (x: Double, y: Double), bounds: Bounds,
    measure: GeometryBoardFields.Measure, minArea: Double, step: Double
  ) -> [Point]? {
    guard points.indices.contains(index), points[index].movable else {
      return nil
    }

    var moved = points[index]

    if moved.track != .vertical {
      moved.x = ChartsMath.snap(target.x, min: bounds.minX, max: bounds.maxX, step: step)
    }

    if moved.track != .horizontal {
      moved.y = ChartsMath.snap(target.y, min: bounds.minY, max: bounds.maxY, step: step)
    }

    var next = points
    next[index] = moved

    return isValid(next, bounds: bounds, measure: measure, minArea: minArea) ? next : nil
  }
}
