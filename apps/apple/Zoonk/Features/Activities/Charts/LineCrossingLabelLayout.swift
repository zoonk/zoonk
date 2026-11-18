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
    let visibleLines = shown.map(\.segment)
    let before = place(shown, in: area, lines: visibleLines, obstacles: obstacles, guides: guides)
    let answerLines = revealed.map(\.segment)
    guard !answerLines.isEmpty else { return before }

    let lines = visibleLines + answerLines
    func needsPlacement(_ box: CGRect, named: Segment) -> Bool {
      answerLines.contains { touches(padded(box), $0) }
        || !belongsWith(box, named: named, lines: answerLines)
    }

    var placed = zip(before, shown).map { box, label in
      box.flatMap { needsPlacement($0, named: label.segment) ? nil : $0 }
    }

    for (index, label) in shown.enumerated() {
      guard let origin = before[index], placed[index] == nil else { continue }
      placed[index] = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles + placed.compactMap { $0 },
        origin: origin, guides: guides, requiredLines: answerLines)
    }

    return placed
      + place(
        revealed, in: area, lines: lines, obstacles: obstacles + placed.compactMap { $0 },
        guides: guides, requiredLines: answerLines)
  }

  static func place(
    _ labels: [Label], in area: CGRect, lines: [Segment], obstacles: [CGRect],
    guides: [Segment] = [], requiredLines: [Segment] = []
  ) -> [CGRect?] {
    var placed: [CGRect] = []
    return labels.map { label in
      let box = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles + placed, guides: guides,
        requiredLines: requiredLines)
      if let box { placed.append(box) }
      return box
    }
  }

  private static func placeLabel(
    _ label: Label, in area: CGRect, lines: [Segment], obstacles: [CGRect],
    origin: CGRect? = nil, guides: [Segment], requiredLines: [Segment]
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

    func search(
      spacing: CGFloat = 0, preferOwnLine: Bool = false, edgesOnly: Bool = false,
      _ accepts: (CGRect) -> Bool
    )
      -> CGRect?
    {
      let spacing = spacing > 0 ? spacing : step
      var best: CGRect?
      var bestGap = CGFloat.infinity
      var distance = CGFloat.infinity
      let lastRow = Int(ceil(height / spacing))
      let lastColumn = Int(ceil(width / spacing))
      for row in 0...lastRow {
        let sidesOnly = edgesOnly && row > 0 && row < lastRow
        for index in 0...(sidesOnly ? min(1, lastColumn) : lastColumn) {
          let column = sidesOnly ? index * lastColumn : index
          let box = CGRect(
            x: area.minX + min(width, CGFloat(column) * spacing),
            y: area.minY + min(height, CGFloat(row) * spacing),
            width: label.size.width, height: label.size.height)
          let dx = box.midX - start.midX
          let dy = box.midY - start.midY
          let cost = dx * dx + dy * dy
          guard area.contains(box) else { continue }
          if !preferOwnLine && cost >= distance { continue }
          guard accepts(box) else { continue }
          let gap = preferOwnLine ? gapSquared(box, label.segment) : 0
          if (gap, cost) < (bestGap, distance) {
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
      belongsWith(box, named: label.segment, lines: lines)
    }

    func avoidsMarks(_ box: CGRect) -> Bool {
      obstacles.allSatisfy { !padded(box).intersects($0) }
    }

    let strokes = [label.segment] + lines + guides
    func clearsStrokes(_ box: CGRect) -> Bool {
      strokes.allSatisfy { !touches(padded(box), $0) }
    }

    func fits(_ box: CGRect) -> Bool {
      clearsRequired(box) && belongsToLine(box)
    }

    if let clear = search({ box in
      clearsStrokes(box) && avoidsMarks(box) && fits(box)
        && guides.allSatisfy { gapSquared(box, label.segment) < gapSquared(box, $0) }
    }) {
      return clear
    }
    if let close = search({
      avoidsMarks($0) && !touches(padded($0), label.segment) && fits($0)
    }) {
      return close
    }
    if let offLine = search(
      spacing: 1,
      {
        avoidsMarks($0) && !touches($0, label.segment) && fits($0)
      })
    {
      return offLine
    }
    if label.isOptional && origin == nil { return nil }

    if let owned = search(spacing: 1, { !touches(padded($0), label.segment) && fits($0) })
      ?? search(spacing: 1, { avoidsMarks($0) && fits($0) })
      ?? search(spacing: 1, fits)
      ?? search(spacing: 0.25, edgesOnly: true, fits)
    {
      return owned
    }
    guard !requiredLines.isEmpty else { return belongsToLine(start) ? start : nil }

    func onNamedSide(_ box: CGRect) -> Bool {
      clearsRequired(box)
        && requiredLines.allSatisfy { isOnNamedSide(box, named: label.segment, of: $0) }
    }

    return search(spacing: 1, preferOwnLine: true) { onNamedSide($0) && avoidsMarks($0) }
      ?? search(spacing: 1, preferOwnLine: true, onNamedSide)
      ?? search(spacing: 1) { clearsRequired($0) && clearsStrokes($0) && avoidsMarks($0) }
      ?? search(spacing: 1, clearsRequired)
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

  private static func side(_ point: CGPoint, of line: Segment) -> CGFloat {
    (line.to.x - line.from.x) * (point.y - line.from.y)
      - (line.to.y - line.from.y) * (point.x - line.from.x)
  }

  private static func isOnNamedSide(_ box: CGRect, named: Segment, of line: Segment) -> Bool {
    let center = CGPoint(x: box.midX, y: box.midY)
    return side(center, of: line) * side(closestPoint(center, on: named), of: line) >= 0
  }

  private static func separatesName(_ box: CGRect, named: Segment, by line: Segment) -> Bool {
    let center = CGPoint(x: box.midX, y: box.midY)
    let connector = Segment(from: center, to: closestPoint(center, on: named))
    return side(connector.from, of: line) * side(connector.to, of: line) < 0
      && side(line.from, of: connector) * side(line.to, of: connector) < 0
  }

  private static func belongsWith(_ box: CGRect, named: Segment, lines: [Segment]) -> Bool {
    let own = gapSquared(box, named)
    return lines.allSatisfy {
      $0 == named || (own < gapSquared(box, $0) && !separatesName(box, named: named, by: $0))
    }
  }

  private static func gapSquared(_ box: CGRect, _ line: Segment) -> CGFloat {
    if touches(box, line) { return 0 }
    func cornerGap(_ x: CGFloat, _ y: CGFloat) -> CGFloat {
      let nearest = closestPoint(CGPoint(x: x, y: y), on: line)
      let dx = x - nearest.x
      let dy = y - nearest.y
      return dx * dx + dy * dy
    }

    func endGap(_ point: CGPoint) -> CGFloat {
      let x = max(box.minX - point.x, 0, point.x - box.maxX)
      let y = max(box.minY - point.y, 0, point.y - box.maxY)
      return x * x + y * y
    }

    return min(
      cornerGap(box.minX, box.minY), cornerGap(box.minX, box.maxY),
      cornerGap(box.maxX, box.minY), cornerGap(box.maxX, box.maxY),
      endGap(line.from), endGap(line.to))
  }

  static func touches(_ box: CGRect, _ segment: Segment) -> Bool {
    let from = segment.from
    let to = segment.to
    let low = max(box.minY, min(from.y, to.y))
    let high = min(box.maxY, max(from.y, to.y))
    guard low <= high else { return false }
    if from.y == to.y {
      return max(from.x, to.x) >= box.minX && min(from.x, to.x) <= box.maxX
    }
    let dx = to.x - from.x
    let dy = to.y - from.y
    let first = from.x + (low - from.y) / dy * dx
    let last = from.x + (high - from.y) / dy * dx
    return max(first, last) >= box.minX && min(first, last) <= box.maxX
  }
}
