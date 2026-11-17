import CoreGraphics

enum LineCrossingLabelLayout {
  struct Segment: Equatable {
    let from: CGPoint
    let to: CGPoint
  }

  struct Label {
    let segment: Segment
    let size: CGSize
  }

  static func place(
    _ labels: [Label], in area: CGRect, lines: [Segment], obstacles: [CGRect]
  ) -> [CGRect] {
    var placed: [CGRect] = []
    for (index, label) in labels.enumerated() {
      let end = label.segment.from.y < label.segment.to.y ? label.segment.from : label.segment.to
      let start = CGRect(
        x: end.x < area.midX ? end.x + 8 : end.x - 8 - label.size.width,
        y: end.y - 8 - label.size.height, width: label.size.width, height: label.size.height)
      let step = max(2, label.size.height / 6)
      let width = max(0, area.width - label.size.width)
      let height = max(0, area.height - label.size.height)
      let blocked = obstacles + placed
      var best: CGRect?
      var distance = CGFloat.infinity
      for row in 0...Int(ceil(height / step)) {
        for column in 0...Int(ceil(width / step)) {
          let box = CGRect(
            origin: CGPoint(
              x: area.minX + min(width, CGFloat(column) * step),
              y: area.minY + min(height, CGFloat(row) * step)), size: label.size)
          guard area.contains(box),
            lines.allSatisfy({ !touches(box.insetBy(dx: -3, dy: -3), $0) }),
            blocked.allSatisfy({ !box.insetBy(dx: -3, dy: -3).intersects($0) })
          else { continue }
          let own = gapSquared(box, label.segment)
          guard
            labels.indices.allSatisfy({ index == $0 || own <= gapSquared(box, labels[$0].segment) })
          else { continue }
          let dx = box.midX - start.midX
          let dy = box.midY - start.midY
          let cost = dx * dx + dy * dy
          if cost < distance {
            best = box
            distance = cost
          }
        }
      }
      placed.append(
        best
          ?? CGRect(
            x: min(max(start.minX, area.minX), area.maxX - label.size.width),
            y: min(max(start.minY, area.minY), area.maxY - label.size.height),
            width: label.size.width, height: label.size.height))
    }
    return placed
  }

  private static func gapSquared(_ box: CGRect, _ line: Segment) -> CGFloat {
    if touches(box, line) { return 0 }
    let dx = line.to.x - line.from.x
    let dy = line.to.y - line.from.y
    let length = dx * dx + dy * dy
    let cornerGaps = [box.minX, box.maxX].flatMap { x in
      [box.minY, box.maxY].map { y in
        let along =
          length == 0
          ? 0 : min(1, max(0, ((x - line.from.x) * dx + (y - line.from.y) * dy) / length))
        let xGap = x - line.from.x - along * dx
        let yGap = y - line.from.y - along * dy
        return xGap * xGap + yGap * yGap
      }
    }
    let endGaps = [line.from, line.to].map { point in
      let x = max(box.minX - point.x, 0, point.x - box.maxX)
      let y = max(box.minY - point.y, 0, point.y - box.maxY)
      return x * x + y * y
    }
    return (cornerGaps + endGaps).min() ?? 0
  }

  static func touches(_ box: CGRect, _ segment: Segment) -> Bool {
    let dx = segment.to.x - segment.from.x
    let dy = segment.to.y - segment.from.y
    var lower: CGFloat = 0
    var upper: CGFloat = 1
    for (p, q) in [
      (-dx, segment.from.x - box.minX), (dx, box.maxX - segment.from.x),
      (-dy, segment.from.y - box.minY), (dy, box.maxY - segment.from.y),
    ] {
      if p == 0 {
        if q < 0 { return false }
      } else if p < 0 {
        lower = max(lower, q / p)
      } else {
        upper = min(upper, q / p)
      }
      if lower > upper { return false }
    }
    return true
  }
}
