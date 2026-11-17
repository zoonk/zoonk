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
    var question: Bool = false
    func at(_ center: CGPoint) -> Label {
      Label(
        center: center, size: size, angle: angle, street: street, priority: priority,
        positions: positions, question: question)
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
  private static func clearOfPin(_ label: Label, _ pin: CGPoint) -> Bool {
    abs(label.center.x - pin.x) >= projection(label, CGPoint(x: 1, y: 0)) + 23
      || abs(label.center.y - pin.y) >= projection(label, CGPoint(x: 0, y: 1)) + 23
  }
  private static func clearOfLabel(_ label: Label, _ other: Label) -> Bool {
    abs(label.center.x - other.center.x) >= projection(label, CGPoint(x: 1, y: 0))
      + projection(other, CGPoint(x: 1, y: 0)) + 3
      || abs(label.center.y - other.center.y) >= projection(label, CGPoint(x: 0, y: 1))
        + projection(other, CGPoint(x: 0, y: 1)) + 3
  }
  private static func inFrame(_ label: Label, _ frame: CGSize) -> Bool {
    let rx = projection(label, CGPoint(x: 1, y: 0))
    let ry = projection(label, CGPoint(x: 0, y: 1))
    return label.center.x >= rx && label.center.x + rx <= frame.width && label.center.y >= ry
      && label.center.y + ry <= frame.height
  }
  struct Placement: Equatable {
    let center: CGPoint
    var scale: Double = 1
    var overPinCircle = false
    var x: Double { center.x }
    var y: Double { center.y }
  }
  private static let minLabelScale = 0.8
  private static let maxStreetOffset = 40.0
  static let streetSampleStep = 4.0
  private static func pathDistance(_ point: CGPoint, _ path: [CGPoint]) -> Double {
    path.indices.map { index in
      let from = path[index]
      let to = index + 1 < path.count ? path[index + 1] : from
      let dx = to.x - from.x
      let dy = to.y - from.y
      let t =
        dx == 0 && dy == 0
        ? 0
        : clamp(
          ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy), 0, 1)
      return hypot(point.x - from.x - t * dx, point.y - from.y - t * dy)
    }.min() ?? .infinity
  }
  private static func besideOwnStreet(_ label: Label, _ streets: [[CGPoint]]) -> Bool {
    if !label.street { return true }
    let path = label.positions ?? []
    let distance = pathDistance(label.center, path)
    return distance <= maxStreetOffset
      && streets.allSatisfy {
        $0 == path || distance + label.size.height / 2 <= pathDistance(label.center, $0)
      }
  }
  private static func streetCandidates(
    _ label: Label, inlineFrame: CGSize? = nil, boxes: [CGRect] = []
  ) -> [CGPoint] {
    let normal = axes(label)[1]
    let offset = min(maxStreetOffset, projection(label, normal) + 23)
    let path = label.positions ?? []
    var offsets: [Double] = [0, -offset, offset]
    for step in 1...Int(maxStreetOffset / streetSampleStep) {
      offsets.append(-Double(step) * streetSampleStep)
      offsets.append(Double(step) * streetSampleStep)
    }
    return path.indices.flatMap { index -> [CGPoint] in
      let from = path[index]
      let to = index + 1 < path.count ? path[index + 1] : from
      let steps = max(1, Int(ceil(hypot(to.x - from.x, to.y - from.y) / streetSampleStep)))
      let rx = projection(label, CGPoint(x: 1, y: 0))
      let ry = projection(label, CGPoint(x: 0, y: 1))
      let xs: [Double] =
        inlineFrame.map { [rx, $0.width - rx] + boxes.flatMap { [$0.minX - rx, $0.maxX + rx] } }
        ?? []
      let ys: [Double] =
        inlineFrame.map { [ry, $0.height - ry] + boxes.flatMap { [$0.minY - ry, $0.maxY + ry] } }
        ?? []
      let regular = (0..<steps).map { Double($0) / Double(steps) }
      let alongX = xs.map { ($0 - from.x) / (to.x - from.x) }
      let alongY = ys.map { ($0 - from.y) / (to.y - from.y) }
      let fractions = (regular + alongX + alongY).filter { $0 >= 0 && $0 <= 1 }
      let cuts = fractions.sorted()
      let midpoints = zip(cuts, cuts.dropFirst()).map { ($0 + $1) / 2 }
      let candidates = inlineFrame == nil ? fractions : cuts + midpoints
      return candidates.flatMap { t -> [CGPoint] in
        let point = CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        return (inlineFrame == nil ? offsets : [0]).map { across in
          CGPoint(x: point.x + normal.x * across, y: point.y + normal.y * across)
        }
      }
    }
  }
  private static func namedCandidates(
    _ label: Label, placed: [Label], pins: [CGPoint], frame: CGSize
  ) -> [CGPoint] {
    if label.street { return streetCandidates(label) }
    let rx = projection(label, CGPoint(x: 1, y: 0))
    let ry = projection(label, CGPoint(x: 0, y: 1))
    if rx * 2 > frame.width || ry * 2 > frame.height { return [] }
    let seeds = (label.positions ?? []) + [label.center]
    let obstacles =
      placed.map {
        ($0.center, projection($0, CGPoint(x: 1, y: 0)), projection($0, CGPoint(x: 0, y: 1)))
      } + pins.map { ($0, 20.0, 20.0) }
    let rawX: [Double] =
      [rx, Double(frame.width) - rx] + seeds.map { Double($0.x) }
      + obstacles.flatMap { p, x, _ in [p.x - rx - x - 3, p.x + rx + x + 3] }
    let rawY: [Double] =
      [ry, Double(frame.height) - ry] + seeds.map { Double($0.y) }
      + obstacles.flatMap { p, _, y in [p.y - ry - y - 3, p.y + ry + y + 3] }
    let xs = rawX.map { clamp($0, rx, frame.width - rx) }.reduce(into: [Double]()) {
      if !$0.contains($1) { $0.append($1) }
    }
    let ys = rawY.map { clamp($0, ry, frame.height - ry) }.reduce(into: [Double]()) {
      if !$0.contains($1) { $0.append($1) }
    }
    return xs.flatMap { x in ys.map { y in CGPoint(x: x, y: y) } }
  }
  static func isNamed(references: String, source: String, text: String) -> Bool {
    let named = references.lowercased()
    return [source, text].contains { !$0.isEmpty && named.contains($0.lowercased()) }
  }
  static func placeLabels(
    _ labels: [Label], pins: [CGPoint], frame: CGSize, streets: [[CGPoint]]? = nil,
    pinNumbers: [CGRect]? = nil
  ) -> [Placement?] {
    let streetPaths = streets ?? labels.filter(\.street).compactMap(\.positions)
    let order = labels.indices.sorted { a, b in
      if labels[a].question != labels[b].question { return labels[a].question }
      if labels[a].priority != labels[b].priority { return labels[a].priority }
      return a < b
    }
    let named = order.filter { labels[$0].priority || labels[$0].question }
    struct Layout {
      var placed: [Label]
      var spots: [Placement?]
    }
    func arrange(_ scale: Double, _ pack: Bool) -> Layout {
      var placed: [Label] = []
      var spots = [Placement?](repeating: nil, count: labels.count)
      for index in named {
        let original = labels[index]
        let label = Label(
          center: original.center,
          size: CGSize(width: original.size.width * scale, height: original.size.height * scale),
          angle: original.angle, street: original.street, priority: original.priority,
          positions: original.positions, question: original.question)
        let points = namedCandidates(label, placed: placed, pins: pins, frame: frame).enumerated()
          .sorted { a, b in
            if pack {
              return a.element.y == b.element.y
                ? a.element.x < b.element.x : a.element.y < b.element.y
            }
            let da = hypot(a.element.x - label.center.x, a.element.y - label.center.y)
            let db = hypot(b.element.x - label.center.x, b.element.y - label.center.y)
            return da == db ? a.offset < b.offset : da < db
          }.map(\.element)
        let originalPoints = (label.street ? (label.positions ?? []) : [label.center]).sorted {
          hypot($0.x - label.center.x, $0.y - label.center.y)
            < hypot($1.x - label.center.x, $1.y - label.center.y)
        }
        let spot = (pack ? points : originalPoints + points).map { label.at($0) }.first {
          candidate in
          inFrame(candidate, frame) && pins.allSatisfy { clearOfPin(candidate, $0) }
            && besideOwnStreet(candidate, streetPaths)
            && placed.allSatisfy { clearOfLabel(candidate, $0) }
        }
        if let spot {
          placed.append(spot)
          spots[index] = Placement(center: spot.center, scale: scale)
        }
      }
      return Layout(placed: placed, spots: spots)
    }
    var layouts: [Layout] = []
    for scale in [1.0, (1 + minLabelScale) / 2, minLabelScale] {
      layouts.append(arrange(scale, false))
      if layouts.last!.placed.count == named.count { break }
      layouts.append(arrange(scale, true))
      if layouts.last!.placed.count == named.count { break }
    }
    var chosen =
      layouts.first { $0.placed.count == named.count }
      ?? layouts.enumerated().sorted { a, b in
        let qa = named.filter { labels[$0].question && a.element.spots[$0] != nil }.count
        let qb = named.filter { labels[$0].question && b.element.spots[$0] != nil }.count
        if qa != qb { return qa > qb }
        if a.element.placed.count != b.element.placed.count {
          return a.element.placed.count > b.element.placed.count
        }
        return a.offset < b.offset
      }.first!.element
    // The last resort stays on the street's line and may cover a circle, never its number.
    if let pinNumbers, pinNumbers.count == pins.count {
      for index in named where chosen.spots[index] == nil && labels[index].street {
        let original = labels[index]
        let label = Label(
          center: original.center,
          size: CGSize(
            width: original.size.width * minLabelScale, height: original.size.height * minLabelScale
          ),
          angle: original.angle, street: true, priority: original.priority,
          positions: original.positions, question: original.question)
        let boxes =
          pinNumbers
          + chosen.placed.map { other in
            let rx = projection(other, CGPoint(x: 1, y: 0)) + 3
            let ry = projection(other, CGPoint(x: 0, y: 1)) + 3
            return CGRect(
              x: other.center.x - rx, y: other.center.y - ry, width: rx * 2, height: ry * 2)
          }
        let spot = streetCandidates(label, inlineFrame: frame, boxes: boxes).sorted {
          hypot($0.x - label.center.x, $0.y - label.center.y)
            < hypot($1.x - label.center.x, $1.y - label.center.y)
        }.map { label.at($0) }.first { candidate in
          inFrame(candidate, frame) && chosen.placed.allSatisfy { clearOfLabel(candidate, $0) }
            && pinNumbers.allSatisfy { box in
              abs(candidate.center.x - box.midX) >= projection(candidate, CGPoint(x: 1, y: 0)) + box
                .width / 2 + 3
                || abs(candidate.center.y - box.midY) >= projection(candidate, CGPoint(x: 0, y: 1))
                  + box.height / 2 + 3
            }
        }
        if let spot {
          chosen.placed.append(spot)
          chosen.spots[index] = Placement(
            center: spot.center, scale: minLabelScale, overPinCircle: true)
        }
      }
    }
    for index in order where !labels[index].priority && !labels[index].question {
      let label = labels[index]
      let spot = (label.street ? (label.positions ?? []) : [label.center]).sorted {
        hypot($0.x - label.center.x, $0.y - label.center.y)
          < hypot($1.x - label.center.x, $1.y - label.center.y)
      }.map { label.at($0) }.first { candidate in
        inFrame(candidate, frame) && pins.allSatisfy { clearOfPin(candidate, $0) }
          && besideOwnStreet(candidate, streetPaths)
          && chosen.placed.allSatisfy { clearOfLabel(candidate, $0) }
      }
      if let spot {
        chosen.placed.append(spot)
        chosen.spots[index] = Placement(center: spot.center)
      }
    }
    return chosen.spots
  }

  private static let minAspect = 0.62
  static let maxAspect = 1.05
  private static let spreadPadding = 0.6
  private static let edgePadding = 0.06
  private static let relaxRounds = 40

  static func fit(
    map: CGSize, maxAspect wantedMaxAspect: Double = maxAspect, maxZoom: Double,
    points: [CGPoint], minAspect wantedMinAspect: Double? = nil
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
      maxAspect: min(wantedMaxAspect, maxAspect), minAspect: wantedMinAspect ?? minAspect)
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

  private static func withAspect(
    _ box: CGSize, maxAspect: Double, minAspect wantedMinAspect: Double = minAspect
  ) -> CGSize {
    let aspect = box.height / box.width
    let floor = min(wantedMinAspect, maxAspect)

    if aspect > maxAspect {
      return CGSize(width: box.height / maxAspect, height: box.height)
    }

    return aspect < floor ? CGSize(width: box.width, height: box.width * floor) : box
  }

  private static func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
    min(max(value, low), high)
  }
}
