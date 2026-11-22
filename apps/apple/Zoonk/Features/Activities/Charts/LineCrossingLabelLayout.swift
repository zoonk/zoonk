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

  private struct PreparedSegment {
    let segment: Segment
    let fromX: CGFloat
    let fromY: CGFloat
    let toX: CGFloat
    let toY: CGFloat
    let dx: CGFloat
    let dy: CGFloat
    let lengthSquared: CGFloat
    let minX: CGFloat
    let maxX: CGFloat
    let minY: CGFloat
    let maxY: CGFloat

    init(_ segment: Segment) {
      self.segment = segment
      fromX = segment.from.x
      fromY = segment.from.y
      toX = segment.to.x
      toY = segment.to.y
      dx = toX - fromX
      dy = toY - fromY
      lengthSquared = dx * dx + dy * dy
      minX = min(fromX, toX)
      maxX = max(fromX, toX)
      minY = min(fromY, toY)
      maxY = max(fromY, toY)
    }
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
    var placed = before.map { box in
      box.flatMap { name in
        answerLines.contains { touches(padded(name), $0) } ? nil : name
      }
    }

    for (index, label) in shown.enumerated() {
      guard let origin = before[index], placed[index] == nil else { continue }
      placed[index] = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles, placed: placed.compactMap { $0 },
        origin: origin, guides: guides, requiredLines: answerLines)
    }

    return placed
      + place(
        revealed, in: area, lines: lines, obstacles: obstacles,
        guides: guides, requiredLines: answerLines, placed: placed.compactMap { $0 })
  }

  static func place(
    _ labels: [Label], in area: CGRect, lines: [Segment], obstacles: [CGRect],
    guides: [Segment] = [], requiredLines: [Segment] = [], placed: [CGRect] = []
  ) -> [CGRect?] {
    var occupied = placed
    return labels.map { label in
      let box = placeLabel(
        label, in: area, lines: lines, obstacles: obstacles, placed: occupied, guides: guides,
        requiredLines: requiredLines)
      if let box { occupied.append(box) }
      return box
    }
  }

  private static func placeLabel(
    _ label: Label, in area: CGRect, lines: [Segment], obstacles: [CGRect],
    placed: [CGRect], origin: CGRect? = nil, guides: [Segment], requiredLines: [Segment]
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
    let halfW = label.size.width / 2
    let halfH = label.size.height / 2

    let namedLine = PreparedSegment(label.segment)
    let otherLines = lines.filter { $0 != label.segment }.map(PreparedSegment.init)
    let otherGuides = guides.filter { $0 != label.segment }.map(PreparedSegment.init)
    let preparedGuides = guides.map(PreparedSegment.init)
    let preparedRequired = requiredLines.map(PreparedSegment.init)
    let preparedStrokes = [namedLine] + lines.map(PreparedSegment.init) + preparedGuides

    func boxes(spacing: CGFloat, edgesOnly: Bool = false) -> [CGRect] {
      var boxes: [CGRect] = []
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
          if area.contains(box) { boxes.append(box) }
        }
      }
      return boxes
    }

    func nearest(
      _ boxes: [CGRect], preferOwnLine: Bool = false, _ accepts: (CGRect) -> Bool
    ) -> CGRect? {
      var best: CGRect?
      var bestGap = CGFloat.infinity
      var distance = CGFloat.infinity
      for box in boxes {
        let dx = box.midX - start.midX
        let dy = box.midY - start.midY
        let cost = dx * dx + dy * dy
        if !preferOwnLine && cost >= distance { continue }
        guard accepts(box) else { continue }
        let gap = preferOwnLine ? gapSquared(box, namedLine) : 0
        if (gap, cost) < (bestGap, distance) {
          best = box
          bestGap = gap
          distance = cost
        }
      }
      return best
    }

    func clearsRequired(_ box: CGRect) -> Bool {
      guard !preparedRequired.isEmpty else { return true }
      let halo = padded(box)
      return preparedRequired.allSatisfy { !touches(halo, $0) }
    }

    func belongsToLine(_ box: CGRect) -> Bool {
      belongsWith(box, named: namedLine, others: otherLines)
    }

    func avoidsMarks(_ box: CGRect) -> Bool {
      let halo = padded(box)
      return obstacles.allSatisfy { !halo.intersects($0) }
        && placed.allSatisfy { !halo.intersects($0) }
    }

    func clearsStrokes(_ box: CGRect) -> Bool {
      let halo = padded(box)
      return preparedStrokes.allSatisfy { !touches(halo, $0) }
    }

    func avoidsNames(_ box: CGRect) -> Bool {
      placed.allSatisfy { box.intersection($0).isEmpty }
    }

    func safe(_ box: CGRect) -> Bool {
      clearsRequired(box) && avoidsNames(box)
    }

    func nearerThanGuides(_ box: CGRect) -> Bool {
      guard !preparedGuides.isEmpty else { return true }
      let own = gapSquared(box, namedLine)
      return preparedGuides.allSatisfy { own < gapSquared(box, $0) }
    }

    func named(_ box: CGRect) -> Bool {
      safe(box) && belongsToLine(box)
    }

    func fits(_ box: CGRect) -> Bool {
      named(box) && belongsWith(box, named: namedLine, others: otherGuides)
    }

    let coarse = boxes(spacing: step)
    if let clear = nearest(coarse, { clearsStrokes($0) && avoidsMarks($0) && fits($0) }) {
      return clear
    }
    if let close = nearest(
      coarse, { avoidsMarks($0) && !touches(padded($0), namedLine) && fits($0) })
    {
      return close
    }
    func offLine(_ box: CGRect) -> Bool {
      avoidsMarks(box) && !touches(box, namedLine)
    }

    // Fine 1-point search expands in rings around `start` with lazy per-cell caching, stopping
    // once no outer ring can beat the closest match found so far.
    let lastRow = Int(ceil(height))
    let lastColumn = Int(ceil(width))
    let columns = lastColumn + 1
    let rows = lastRow + 1
    let gridHasBoxes = area.contains(
      CGRect(x: area.minX, y: area.minY, width: label.size.width, height: label.size.height))

    let startCol = max(0, min(lastColumn, Int((start.minX - area.minX).rounded())))
    let startRow = max(0, min(lastRow, Int((start.minY - area.minY).rounded())))
    let maxRadius = max(
      max(startCol, lastColumn - startCol),
      max(startRow, lastRow - startRow))

    var cache = gridHasBoxes ? [UInt8](repeating: 0, count: rows * columns) : []
    let safeKnown: UInt8 = 1 << 0
    let safeYes: UInt8 = 1 << 1
    let belongsKnown: UInt8 = 1 << 2
    let belongsYes: UInt8 = 1 << 3
    let fitsKnown: UInt8 = 1 << 4
    let fitsYes: UInt8 = 1 << 5

    @inline(__always)
    func boxAt(_ row: Int, _ column: Int) -> CGRect {
      CGRect(
        x: area.minX + min(width, CGFloat(column)),
        y: area.minY + min(height, CGFloat(row)),
        width: label.size.width, height: label.size.height)
    }

    func isSafeCell(_ idx: Int, _ box: CGRect) -> Bool {
      let flags = cache[idx]
      if flags & safeKnown != 0 { return flags & safeYes != 0 }
      let ok = safe(box)
      cache[idx] = flags | safeKnown | (ok ? safeYes : 0)
      return ok
    }

    func isNamedCell(_ idx: Int, _ box: CGRect) -> Bool {
      guard isSafeCell(idx, box) else { return false }
      let flags = cache[idx]
      if flags & belongsKnown != 0 { return flags & belongsYes != 0 }
      let ok = belongsToLine(box)
      cache[idx] = flags | belongsKnown | (ok ? belongsYes : 0)
      return ok
    }

    let hasGuides = !preparedGuides.isEmpty
    let hasOtherGuides = !otherGuides.isEmpty

    func isFitsCell(_ idx: Int, _ box: CGRect) -> Bool {
      guard isNamedCell(idx, box) else { return false }
      guard hasOtherGuides else { return true }
      let flags = cache[idx]
      if flags & fitsKnown != 0 { return flags & fitsYes != 0 }
      let ok = belongsWith(box, named: namedLine, others: otherGuides)
      cache[idx] = flags | fitsKnown | (ok ? fitsYes : 0)
      return ok
    }

    @inline(__always)
    func ringMinEdge(_ r: Int) -> CGFloat {
      var minEdge = CGFloat.infinity
      if startCol - r >= 0 {
        let x = area.minX + min(width, CGFloat(startCol - r)) + halfW
        minEdge = min(minEdge, max(0, start.midX - x))
      }
      if startCol + r <= lastColumn {
        let x = area.minX + min(width, CGFloat(startCol + r)) + halfW
        minEdge = min(minEdge, max(0, x - start.midX))
      }
      if startRow - r >= 0 {
        let y = area.minY + min(height, CGFloat(startRow - r)) + halfH
        minEdge = min(minEdge, max(0, start.midY - y))
      }
      if startRow + r <= lastRow {
        let y = area.minY + min(height, CGFloat(startRow + r)) + halfH
        minEdge = min(minEdge, max(0, y - start.midY))
      }
      return minEdge
    }

    @inline(__always)
    func walkRing(_ r: Int, _ visit: (Int, Int) -> Void) {
      if r == 0 {
        visit(startRow, startCol)
        return
      }
      let topRow = startRow - r
      let bottomRow = startRow + r
      let leftCol = max(0, startCol - r)
      let rightCol = min(lastColumn, startCol + r)

      if topRow >= 0 {
        for col in leftCol...rightCol { visit(topRow, col) }
      }
      if bottomRow <= lastRow {
        for col in leftCol...rightCol { visit(bottomRow, col) }
      }
      let innerTop = max(0, topRow + 1)
      let innerBottom = min(lastRow, bottomRow - 1)
      if innerTop <= innerBottom {
        if startCol - r >= 0 {
          let col = startCol - r
          for row in innerTop...innerBottom { visit(row, col) }
        }
        if startCol + r <= lastColumn {
          let col = startCol + r
          for row in innerTop...innerBottom { visit(row, col) }
        }
      }
    }

    func nearestGrid(_ accepts: (Int, CGRect) -> Bool) -> CGRect? {
      guard gridHasBoxes else { return nil }
      var best: CGRect?
      var bestCost = CGFloat.infinity
      var bestIndex = Int.max

      @inline(__always)
      func visit(_ row: Int, _ col: Int) {
        let box = boxAt(row, col)
        let dx = box.midX - start.midX
        let dy = box.midY - start.midY
        let cost = dx * dx + dy * dy
        let idx = row * columns + col
        if cost > bestCost || (cost == bestCost && idx >= bestIndex) { return }
        guard area.contains(box), accepts(idx, box) else { return }
        best = box
        bestCost = cost
        bestIndex = idx
      }

      for r in 0...maxRadius {
        if best != nil && r > 0 {
          let minEdge = ringMinEdge(r)
          if minEdge * minEdge > bestCost { break }
        }
        walkRing(r, visit)
      }

      return best
    }

    /// Evaluates the three `preferred` passes (`clearsStrokes`, `offLine`, `avoidsMarks`, all
    /// requiring `avoidsMarks && isFitsCell`) in one expanding-ring scan.
    func preferredGrid() -> CGRect? {
      guard gridHasBoxes else { return nil }
      var bestClear: CGRect?
      var bestClearCost = CGFloat.infinity
      var bestClearIndex = Int.max
      var bestOffLine: CGRect?
      var bestOffLineCost = CGFloat.infinity
      var bestOffLineIndex = Int.max
      var bestMarks: CGRect?
      var bestMarksCost = CGFloat.infinity
      var bestMarksIndex = Int.max

      @inline(__always)
      func visit(_ row: Int, _ col: Int) {
        let box = boxAt(row, col)
        let dx = box.midX - start.midX
        let dy = box.midY - start.midY
        let cost = dx * dx + dy * dy
        let idx = row * columns + col
        if bestClear != nil
          && (cost > bestClearCost || (cost == bestClearCost && idx >= bestClearIndex))
        {
          return
        }
        guard area.contains(box), avoidsMarks(box), isFitsCell(idx, box) else { return }
        if cost < bestMarksCost || (cost == bestMarksCost && idx < bestMarksIndex) {
          bestMarks = box
          bestMarksCost = cost
          bestMarksIndex = idx
        }
        if !touches(box, namedLine) {
          if cost < bestOffLineCost || (cost == bestOffLineCost && idx < bestOffLineIndex) {
            bestOffLine = box
            bestOffLineCost = cost
            bestOffLineIndex = idx
          }
          if clearsStrokes(box) {
            if cost < bestClearCost || (cost == bestClearCost && idx < bestClearIndex) {
              bestClear = box
              bestClearCost = cost
              bestClearIndex = idx
            }
          }
        }
      }

      for r in 0...maxRadius {
        if bestClear != nil && r > 0 {
          let minEdge = ringMinEdge(r)
          if minEdge * minEdge > bestClearCost { break }
        }
        walkRing(r, visit)
      }

      return bestClear ?? bestOffLine ?? bestMarks
    }

    func edgeBoxes() -> [CGRect] { boxes(spacing: 0.25, edgesOnly: true) }

    let preferred = preferredGrid()
    if label.isOptional && origin == nil {
      if let preferred { return preferred }
      if let edge = nearest(edgeBoxes(), { avoidsMarks($0) && fits($0) }) { return edge }
      guard hasGuides else { return nil }
      return nearestGrid({ offLine($1) && isNamedCell($0, $1) && nearerThanGuides($1) })
        ?? nearestGrid({ offLine($1) && isNamedCell($0, $1) })
    }

    if let preferred { return preferred }

    if let owned =
      nearestGrid({ idx, box in
        let halo = padded(box)
        return !touches(halo, namedLine) && obstacles.allSatisfy { !halo.intersects($0) }
          && isFitsCell(idx, box)
      })
      ?? nearestGrid({ isFitsCell($0, $1) })
      ?? nearest(edgeBoxes(), fits)
      ?? (hasGuides ? nearestGrid({ isNamedCell($0, $1) && nearerThanGuides($1) }) : nil)
      ?? (hasOtherGuides ? nearestGrid({ avoidsMarks($1) && isNamedCell($0, $1) }) : nil)
      ?? (hasOtherGuides ? nearestGrid({ isNamedCell($0, $1) }) : nil)
    {
      return owned
    }

    func onNamedSide(_ box: CGRect) -> Bool {
      preparedRequired.allSatisfy { isOnNamedSide(box, named: namedLine, of: $0) }
    }

    /// Evaluates both `preferOwnLine` passes (`avoidsMarks` first, then unconstrained) in one scan.
    func fallback(_ accepts: (CGRect) -> Bool) -> CGRect? {
      guard gridHasBoxes else { return nil }
      var bestMarks: CGRect?
      var bestMarksGap = CGFloat.infinity
      var bestMarksCost = CGFloat.infinity
      var bestAny: CGRect?
      var bestAnyGap = CGFloat.infinity
      var bestAnyCost = CGFloat.infinity

      for row in 0...lastRow {
        for col in 0...lastColumn {
          let box = boxAt(row, col)
          let idx = row * columns + col
          guard area.contains(box), isSafeCell(idx, box), accepts(box), onNamedSide(box) else {
            continue
          }
          let marks = avoidsMarks(box)
          if bestMarks != nil && !marks { continue }
          let gap = gapSquared(box, namedLine)
          if marks {
            if gap <= bestMarksGap {
              let dx = box.midX - start.midX
              let dy = box.midY - start.midY
              let cost = dx * dx + dy * dy
              if (gap, cost) < (bestMarksGap, bestMarksCost) {
                bestMarks = box
                bestMarksGap = gap
                bestMarksCost = cost
              }
            }
          } else if gap <= bestAnyGap {
            let dx = box.midX - start.midX
            let dy = box.midY - start.midY
            let cost = dx * dx + dy * dy
            if (gap, cost) < (bestAnyGap, bestAnyCost) {
              bestAny = box
              bestAnyGap = gap
              bestAnyCost = cost
            }
          }
        }
      }

      return bestMarks ?? bestAny ?? nearestGrid({ isSafeCell($0, $1) && accepts($1) })
    }

    return (hasGuides ? fallback(nearerThanGuides) : nil) ?? fallback({ _ in true })
      ?? (requiredLines.isEmpty && belongsToLine(start) && avoidsNames(start) ? start : nil)
  }

  private static func padded(_ box: CGRect) -> CGRect {
    box.insetBy(dx: -clearance, dy: -clearance)
  }

  private static func closestPoint(_ point: CGPoint, on line: PreparedSegment) -> CGPoint {
    let along =
      line.lengthSquared == 0
      ? 0
      : min(
        1,
        max(
          0,
          ((point.x - line.fromX) * line.dx + (point.y - line.fromY) * line.dy) / line.lengthSquared
        ))
    return CGPoint(x: line.fromX + along * line.dx, y: line.fromY + along * line.dy)
  }

  private static func side(_ point: CGPoint, of line: PreparedSegment) -> CGFloat {
    line.dx * (point.y - line.fromY) - line.dy * (point.x - line.fromX)
  }

  private static func side(_ point: CGPoint, from: CGPoint, to: CGPoint) -> CGFloat {
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)
  }

  private static func isOnNamedSide(
    _ box: CGRect, named: PreparedSegment, of line: PreparedSegment
  ) -> Bool {
    let center = CGPoint(x: box.midX, y: box.midY)
    return side(center, of: line) * side(closestPoint(center, on: named), of: line) >= 0
  }

  private static func separatesName(
    _ box: CGRect, named: PreparedSegment, by line: PreparedSegment
  ) -> Bool {
    let center = CGPoint(x: box.midX, y: box.midY)
    let target = closestPoint(center, on: named)
    return side(center, of: line) * side(target, of: line) < 0
      && side(line.segment.from, from: center, to: target)
        * side(line.segment.to, from: center, to: target) < 0
  }

  private static func belongsWith(
    _ box: CGRect, named: PreparedSegment, others: [PreparedSegment]
  ) -> Bool {
    guard !others.isEmpty else { return true }
    let own = gapSquared(box, named)
    for other in others {
      guard own < gapSquared(box, other) && !separatesName(box, named: named, by: other) else {
        return false
      }
    }
    return true
  }

  private static func gapSquared(_ box: CGRect, _ line: PreparedSegment) -> CGFloat {
    if touches(box, line) { return 0 }
    @inline(__always)
    func cornerGap(_ x: CGFloat, _ y: CGFloat) -> CGFloat {
      let nearest = closestPoint(CGPoint(x: x, y: y), on: line)
      let dx = x - nearest.x
      let dy = y - nearest.y
      return dx * dx + dy * dy
    }

    @inline(__always)
    func endGap(_ x: CGFloat, _ y: CGFloat) -> CGFloat {
      let gx = max(box.minX - x, 0, x - box.maxX)
      let gy = max(box.minY - y, 0, y - box.maxY)
      return gx * gx + gy * gy
    }

    return min(
      min(
        min(cornerGap(box.minX, box.minY), cornerGap(box.minX, box.maxY)),
        min(cornerGap(box.maxX, box.minY), cornerGap(box.maxX, box.maxY))),
      min(endGap(line.fromX, line.fromY), endGap(line.toX, line.toY)))
  }

  private static func touches(_ box: CGRect, _ segment: PreparedSegment) -> Bool {
    guard segment.maxX >= box.minX && segment.minX <= box.maxX else { return false }
    let low = max(box.minY, segment.minY)
    let high = min(box.maxY, segment.maxY)
    guard low <= high else { return false }
    if segment.dy == 0 {
      return true
    }
    let first = segment.fromX + (low - segment.fromY) / segment.dy * segment.dx
    let last = segment.fromX + (high - segment.fromY) / segment.dy * segment.dx
    return max(first, last) >= box.minX && min(first, last) <= box.maxX
  }

  static func touches(_ box: CGRect, _ segment: Segment) -> Bool {
    touches(box, PreparedSegment(segment))
  }
}
