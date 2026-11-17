import CoreGraphics

/// Mirrors main's `map-viewport`.
enum MapViewport {
  struct Label {
    let center: CGPoint
    let size: CGSize
    let angle: Double
    let street: Bool
    let priority: Bool
    var positions: [CGPoint]? = nil
    func at(_ center: CGPoint) -> Label {
      Label(
        center: center, size: size, angle: angle, street: street, priority: priority,
        positions: positions)
    }
  }
  private static func axes(_ label: Label) -> [CGPoint] {
    let angle = label.angle * .pi / 180
    return [CGPoint(x: cos(angle), y: sin(angle)), CGPoint(x: -sin(angle), y: cos(angle))]
  }
  private static func projection(_ label: Label, _ axis: CGPoint) -> Double {
    let directions = axes(label)
    return (label.size.width / 2 + 1.5) * abs(directions[0].x * axis.x + directions[0].y * axis.y)
      + (label.size.height / 2 + 1.5) * abs(directions[1].x * axis.x + directions[1].y * axis.y)
  }
  static func placeLabels(_ labels: [Label], pins: [CGPoint], frame: CGSize) -> [CGPoint?] {
    var spots = [CGPoint?](repeating: nil, count: labels.count)
    var placed: [Label] = []
    let order = labels.indices.sorted {
      labels[$0].priority == labels[$1].priority ? $0 < $1 : labels[$0].priority
    }
    for index in order {
      let label = labels[index]
      let points = label.street ? (label.positions ?? []) : [label.center]
      let candidates = points.enumerated().sorted {
        let first = hypot($0.element.x - label.center.x, $0.element.y - label.center.y)
        let second = hypot($1.element.x - label.center.x, $1.element.y - label.center.y)
        return first == second ? $0.offset < $1.offset : first < second
      }.map(\.element)
      let spot = candidates.map {
        label.at($0)
      }.first { candidate in
        let rx = projection(candidate, CGPoint(x: 1, y: 0))
        let ry = projection(candidate, CGPoint(x: 0, y: 1))
        return candidate.center.x >= rx && candidate.center.x + rx <= frame.width
          && candidate.center.y >= ry && candidate.center.y + ry <= frame.height
          && pins.allSatisfy { pin in
            let directions = axes(candidate)
            let dx = pin.x - candidate.center.x
            let dy = pin.y - candidate.center.y
            return hypot(
              max(
                abs(dx * directions[0].x + dy * directions[0].y) - candidate.size.width / 2 - 1.5, 0
              ),
              max(
                abs(dx * directions[1].x + dy * directions[1].y) - candidate.size.height / 2 - 1.5,
                0)) >= 23
          }
          && placed.allSatisfy { other in
            (axes(candidate) + axes(other)).contains { axis in
              abs(
                (candidate.center.x - other.center.x) * axis.x
                  + (candidate.center.y - other.center.y) * axis.y) >= projection(candidate, axis)
                + projection(other, axis) + 3
            }
          }
      }
      if let spot {
        placed.append(spot)
        spots[index] = spot.center
      }
    }
    return spots
  }

  private static let minAspect = 0.62
  private static let maxAspect = 1.05
  private static let spreadPadding = 0.6
  private static let edgePadding = 0.06
  private static let relaxRounds = 40

  static func fit(
    map: CGSize, maxAspect wantedMaxAspect: Double = maxAspect, maxZoom: Double,
    points: [CGPoint]
  ) -> CGRect {
    guard let left = points.map(\.x).min(), let right = points.map(\.x).max(),
      let top = points.map(\.y).min(), let bottom = points.map(\.y).max()
    else {
      return CGRect(origin: .zero, size: map)
    }

    let edge = max(map.width, map.height) * edgePadding
    let wanted = withAspect(
      CGSize(
        width: max((right - left) * (1 + spreadPadding) + edge * 2, map.width / maxZoom),
        height: max((bottom - top) * (1 + spreadPadding) + edge * 2, map.height / maxZoom)),
      maxAspect: min(wantedMaxAspect, maxAspect))
    let size = CGSize(width: min(wanted.width, map.width), height: min(wanted.height, map.height))

    return CGRect(
      x: clamp((left + right) / 2 - size.width / 2, 0, map.width - size.width),
      y: clamp((top + bottom) / 2 - size.height / 2, 0, map.height - size.height),
      width: size.width, height: size.height)
  }

  static func spread(_ points: [CGPoint], distance: Double, in frame: CGSize) -> [CGPoint] {
    let inset = distance / 2

    return (0..<relaxRounds).reduce(points) { current, _ in
      current.indices.map { index in
        let point = current[index]
        var push = CGPoint.zero

        for other in current.indices where other != index {
          let dx = point.x - current[other].x
          let dy = point.y - current[other].y
          let gap = (dx * dx + dy * dy).squareRoot()

          guard gap < distance else { continue }

          let unit =
            gap == 0 ? CGPoint(x: other < index ? 1 : -1, y: 0) : CGPoint(x: dx / gap, y: dy / gap)
          let overlap = (distance - gap) / 2
          push.x += unit.x * overlap
          push.y += unit.y * overlap
        }

        return CGPoint(
          x: clamp(point.x + push.x, inset, frame.width - inset),
          y: clamp(point.y + push.y, inset, frame.height - inset))
      }
    }
  }

  private static func withAspect(_ box: CGSize, maxAspect: Double) -> CGSize {
    let aspect = box.height / box.width
    let floor = min(minAspect, maxAspect)

    if aspect > maxAspect {
      return CGSize(width: box.height / maxAspect, height: box.height)
    }

    return aspect < floor ? CGSize(width: box.width, height: box.width * floor) : box
  }

  private static func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
    min(max(value, low), high)
  }
}
