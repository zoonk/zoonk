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

  private static let clearance: CGFloat = 3

  static func chart(
    shown: [Label], revealed: [Label], in area: CGRect, guides: [Segment], obstacles: [CGRect]
  ) -> [CGRect?] {
    let visibleLines = shown.map(\.segment) + guides
    let before = place(shown, in: area, lines: visibleLines, obstacles: obstacles)
    let answerLines = revealed.map(\.segment)
    guard !answerLines.isEmpty else { return before }

    let lines = visibleLines + answerLines
    func crossesAnswer(_ box: CGRect) -> Bool {
      answerLines.contains { touches(padded(box), $0) }
    }

    var placed = before.map { box in
      box.flatMap { crossesAnswer($0) ? nil : $0 }
    }

    for (index, label) in shown.enumerated() {
      guard let origin = before[index], crossesAnswer(origin) else { continue }
      placed[index] = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles + placed.compactMap { $0 },
        origin: origin, requiredLines: answerLines)
    }

    return placed
      + place(
        revealed, in: area, lines: lines, obstacles: obstacles + placed.compactMap { $0 },
        requiredLines: answerLines)
  }

  static func place(
    _ labels: [Label], in area: CGRect, lines: [Segment], obstacles: [CGRect],
    requiredLines: [Segment] = []
  ) -> [CGRect?] {
    var placed: [CGRect] = []
    return labels.map { label in
      let box = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles + placed, requiredLines: requiredLines)
      if let box { placed.append(box) }
      return box
    }
  }

  private static func placeLabel(
    _ label: Label, in area: CGRect, lines: [Segment], obstacles: [CGRect],
    origin: CGRect? = nil, requiredLines: [Segment]
  ) -> CGRect? {
    let end = label.segment.from.y < label.segment.to.y ? label.segment.from : label.segment.to
    let start =
      origin
      ?? CGRect(
        x: end.x < area.midX ? end.x + 8 : end.x - 8 - label.size.width,
        y: label.isUpper ? end.y - 8 - label.size.height : end.y + 8, width: label.size.width,
        height: label.size.height)
    let step = max(2, label.size.height / 6)
    let width = max(0, area.width - label.size.width)
    let height = max(0, area.height - label.size.height)

    func search(preferOwnLine: Bool = false, _ accepts: (CGRect) -> Bool) -> CGRect? {
      var best: CGRect?
      var bestGap = CGFloat.infinity
      var distance = CGFloat.infinity
      for row in 0...Int(ceil(height / step)) {
        for column in 0...Int(ceil(width / step)) {
          let box = CGRect(
            x: area.minX + min(width, CGFloat(column) * step),
            y: area.minY + min(height, CGFloat(row) * step),
            width: label.size.width, height: label.size.height)
          let dx = box.midX - start.midX
          let dy = box.midY - start.midY
          let cost = dx * dx + dy * dy
          guard area.contains(box) else { continue }
          let gap = preferOwnLine ? gapSquared(box, label.segment) : 0
          if (gap, cost) < (bestGap, distance), accepts(box) {
            best = box
            bestGap = gap
            distance = cost
          }
        }
      }
      return best
    }

    func clearsRequired(_ box: CGRect) -> Bool {
      requiredLines.allSatisfy { !touches(padded(box), $0) }
    }

    func belongsToLine(_ box: CGRect) -> Bool {
      guard clearsRequired(box), !touches(padded(box), label.segment) else { return false }
      let own = gapSquared(box, label.segment)
      return lines.allSatisfy { $0 == label.segment || own < gapSquared(box, $0) }
    }

    func clearsLinesAndMarks(_ box: CGRect) -> Bool {
      let paddedBox = padded(box)
      return lines.allSatisfy { !touches(paddedBox, $0) }
        && obstacles.allSatisfy { !paddedBox.intersects($0) }
    }

    let clear = search { clearsLinesAndMarks($0) && belongsToLine($0) }

    if clear != nil || (label.isOptional && origin == nil) {
      return clear
    }

    if origin != nil,
      let besideItsLine = search(
        preferOwnLine: true,
        { box in
          clearsLinesAndMarks(box)
            && requiredLines.allSatisfy { isOnNamedSide(box, named: label.segment, of: $0) }
        })
    {
      return besideItsLine
    }

    return search(clearsLinesAndMarks)
      ?? search(belongsToLine)
      ?? (requiredLines.isEmpty
        ? CGRect(
          x: min(max(start.minX, area.minX), area.maxX - label.size.width),
          y: min(max(start.minY, area.minY), area.maxY - label.size.height),
          width: label.size.width, height: label.size.height)
        : search(clearsRequired))
  }

  private static func padded(_ box: CGRect) -> CGRect {
    box.insetBy(dx: -clearance, dy: -clearance)
  }

  private static func closestPoint(_ point: CGPoint, on line: Segment) -> CGPoint {
    let dx = line.to.x - line.from.x
    let dy = line.to.y - line.from.y
    let length = dx * dx + dy * dy
    let along =
      length == 0
      ? 0
      : min(1, max(0, ((point.x - line.from.x) * dx + (point.y - line.from.y) * dy) / length))
    return CGPoint(x: line.from.x + along * dx, y: line.from.y + along * dy)
  }

  private static func isOnNamedSide(_ box: CGRect, named: Segment, of line: Segment) -> Bool {
    let center = CGPoint(x: box.midX, y: box.midY)
    func side(_ point: CGPoint) -> CGFloat {
      (line.to.x - line.from.x) * (point.y - line.from.y)
        - (line.to.y - line.from.y) * (point.x - line.from.x)
    }
    return side(center) * side(closestPoint(center, on: named)) >= 0
  }

  private static func gapSquared(_ box: CGRect, _ line: Segment) -> CGFloat {
    if touches(box, line) { return 0 }
    let cornerGaps = [box.minX, box.maxX].flatMap { x in
      [box.minY, box.maxY].map { y in
        let nearest = closestPoint(CGPoint(x: x, y: y), on: line)
        let xGap = x - nearest.x
        let yGap = y - nearest.y
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
