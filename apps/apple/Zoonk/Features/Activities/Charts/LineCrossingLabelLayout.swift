import CoreGraphics

enum LineCrossingLabelLayout {
  struct Segment: Equatable {
    let from: CGPoint
    let to: CGPoint
  }

  struct Label {
    let segment: Segment
    let size: CGSize
    var isUpper = true
    var isOptional = false
  }

  // Check reveals a new name around the saved names, without moving any of them.
  static func chart(
    shown: [Label], revealed: [Label], in area: CGRect, guides: [Segment], obstacles: [CGRect]
  ) -> [CGRect?] {
    let shownLines = shown.map(\.segment)
    let placed = place(
      shown, in: area, lines: shownLines + guides, obstacles: obstacles, nearestLines: shownLines)
    return placed
      + place(
        revealed, in: area, lines: (shown + revealed).map(\.segment) + guides,
        obstacles: obstacles, placed: placed.compactMap { $0 },
        nearestLines: (shown + revealed).map(\.segment))
  }

  static func place(
    _ labels: [Label], in area: CGRect, lines: [Segment], obstacles: [CGRect],
    placed initial: [CGRect] = [], nearestLines: [Segment]? = nil
  ) -> [CGRect?] {
    let namedLines = nearestLines ?? lines
    var placed = initial
    var result: [CGRect?] = []
    for label in labels {
      let end = label.segment.from.y < label.segment.to.y ? label.segment.from : label.segment.to
      let start = CGRect(
        x: end.x < area.midX ? end.x + 8 : end.x - 8 - label.size.width,
        y: label.isUpper ? end.y - 8 - label.size.height : end.y + 8, width: label.size.width,
        height: label.size.height)
      let step = max(2, label.size.height / 6)
      let width = max(0, area.width - label.size.width)
      let height = max(0, area.height - label.size.height)
      let blocked = obstacles + placed
      func search(clearsMarks: Bool) -> CGRect? {
        var best: CGRect?
        var distance = CGFloat.infinity
        for row in 0...Int(ceil(height / step)) {
          for column in 0...Int(ceil(width / step)) {
            let box = CGRect(
              x: area.minX + min(width, CGFloat(column) * step),
              y: area.minY + min(height, CGFloat(row) * step),
              width: label.size.width, height: label.size.height)
            let own = gapSquared(box, label.segment)
            guard area.contains(box), !touches(box.insetBy(dx: -3, dy: -3), label.segment),
              namedLines.allSatisfy({ $0 == label.segment || own < gapSquared(box, $0) })
            else { continue }
            if clearsMarks {
              guard lines.allSatisfy({ !touches(box.insetBy(dx: -3, dy: -3), $0) }),
                blocked.allSatisfy({ !box.insetBy(dx: -3, dy: -3).intersects($0) })
              else { continue }
            }
            let dx = box.midX - start.midX
            let dy = box.midY - start.midY
            let cost = dx * dx + dy * dy
            if cost < distance {
              best = box
              distance = cost
            }
          }
        }
        return best
      }
      var best = search(clearsMarks: true)
      if best == nil && !label.isOptional {
        best = search(clearsMarks: false)
      }
      if best == nil && !label.isOptional {
        best = CGRect(
          x: min(max(start.minX, area.minX), area.maxX - label.size.width),
          y: min(max(start.minY, area.minY), area.maxY - label.size.height),
          width: label.size.width, height: label.size.height)
      }
      result.append(best)
      if let best { placed.append(best) }
    }
    return result
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
