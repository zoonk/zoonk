import CoreGraphics

/// Mirrors main's `map-viewport`.
enum MapViewport {
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
