import Foundation

/// Where a plot draws everything, as main's `getPlotLayout` and `getPointLabels` place it, in
/// points for 12-point labels; a larger text size scales the whole drawing. `textWidth` measures a
/// label at that size.
struct LessonPlotLayout {
  static let height = 208.0
  static let top = 22.0
  static let bottom = 26.0
  static let minLeft = 48.0
  static let right = 8.0
  static let labelGap = 6.0
  static let lineHeight = 14.0
  static let tickOffset = 16.0
  static let dotRadius = 4.5
  private static let labelOffset = dotRadius + 3
  private static let clearance = 1.0
  private static let maxKeyMarkerLength = 2
  private static let maxGutterShare = 0.3
  private static let referenceSpacing = 2.0
  /// Main's `COMPACT_FROM`: an axis whose numbers reach this writes them short.
  private static let compactFrom = 10_000.0

  struct Tick {
    let label: String
    let value: Double
  }

  /// A level's name in the gutter past the plot, `top` being its first line's top.
  struct Reference {
    let lines: [String]
    let top: Double
    let y: Double
  }

  enum Anchor { case start, middle, end }

  /// A point's name: `x` is where its `anchor` side sits and `y` its middle.
  struct Label: Equatable {
    let text: String
    let anchor: Anchor
    let x: Double
    let y: Double
  }

  struct KeyEntry: Equatable {
    let marker: String
    let label: String
  }

  struct Box {
    var left, top, right, bottom: Double
  }

  struct Pixel: Equatable {
    let x: Double
    let y: Double
  }

  let left: Double
  let plotRight: Double
  let plotBottom: Double
  let xTicks: [Tick]
  let yTicks: [Tick]
  /// Each series' points, in the drawing's points.
  let series: [[Pixel]]
  let references: [Reference]
  let labels: [Label]
  /// Numbered names, when a name beside its dot would cover another dot or name.
  let key: [KeyEntry]
  /// Large x numbers are written short and grouped; others, like years, in full without grouping.
  let groupsX: Bool

  private let scale: LessonPlotScale
  private let width: Double

  init(
    _ plot: LessonPlot, width: Double, textWidth: @escaping (String) -> Double,
    locale: Locale = .courseLanguage
  ) {
    let scale = LessonPlotScale(plot)
    let points = plot.series.flatMap(\.points)
    let compactX = Self.isLarge(points.map(\.x))
    let compactY = Self.isLarge(points.map(\.y) + plot.references.map(\.y))
    let labelWidth = { (text: String) in textWidth(text) + Self.labelGap }

    let yTicks = scale.y.ticks.map {
      Tick(
        label: ActivityNumberFormat.format($0, compact: compactY, locale: locale), value: $0)
    }
    let left = max(Self.minLeft, yTicks.map { labelWidth($0.label) }.max() ?? 0)
    // Wrapped to a share of the width, but never narrower than the longest word, which would break
    // inside it.
    let room =
      plot.references.isEmpty
      ? 0
      : min(
        plot.references.map { labelWidth($0.label) }.max() ?? 0,
        max(
          width * Self.maxGutterShare,
          plot.references.flatMap { $0.label.split(separator: " ") }.map {
            labelWidth(String($0))
          }.max() ?? 0))

    let plotRight = max(width - (room > 0 ? room + Self.labelGap : Self.right), left + 1)
    let plotBottom = Self.height - Self.bottom
    let toPoint = { (x: Double, y: Double) in
      Pixel(
        x: Self.position(x, domain: scale.x.domain, range: left...plotRight),
        y: Self.position(y, domain: scale.y.domain, range: Self.top...plotBottom, flipped: true))
    }

    self.scale = scale
    self.width = width
    self.groupsX = compactX
    self.left = left
    self.plotRight = plotRight
    self.plotBottom = plotBottom
    self.yTicks = yTicks

    let series = plot.series.map { $0.points.map { toPoint($0.x, $0.y) } }
    self.series = series

    let referenceMarks = plot.references.map { reference in
      let lines = Self.wrap(reference.label, room: room, labelWidth: labelWidth)
      let y = toPoint(scale.x.domain.lowerBound, reference.y).y

      return Reference(lines: lines, top: y - Double(lines.count) * Self.lineHeight / 2, y: y)
    }
    let references = Self.stack(referenceMarks, bottom: plotBottom)
    self.references = references

    let marks = plot.series.map(\.mark)
    let dots = series.enumerated().flatMap { seriesIndex, points in
      points.enumerated().filter { index, _ in
        Self.drawsDot(
          index: index, mark: marks[seriesIndex], pointCount: points.count,
          seriesCount: series.count)
      }.map(\.element)
    }
    let lines = series.enumerated().flatMap { index, points in
      marks[index] == .points ? [] : Array(zip(points, points.dropFirst()))
    }
    let rules = references.map {
      (Pixel(x: left, y: $0.y), Pixel(x: plotRight, y: $0.y))
    }
    let named = plot.series.enumerated().flatMap { seriesIndex, item in
      item.points.enumerated().compactMap { index, point in
        point.label.map { (dot: series[seriesIndex][index], text: $0) }
      }
    }

    let placed = Self.pointLabels(
      named: named,
      scene: Scene(
        bounds: Box(left: left, top: 0, right: room > 0 ? plotRight : width, bottom: plotBottom),
        dots: dots, segments: lines + rules),
      textWidth: textWidth)
    labels = placed.labels
    key = placed.key

    let xTicks = scale.x.ticks.map {
      Tick(
        label: ActivityNumberFormat.format(
          $0, grouping: compactX, compact: compactX, locale: locale), value: $0)
    }
    let frames = xTicks.map { tick in
      let half = labelWidth(tick.label) / 2
      let center = min(max(toPoint(tick.value, scale.y.domain.lowerBound).x, half), width - half)
      return (left: center - half, right: center + half)
    }
    self.xTicks = LessonChartTicks.labeled(frames, gap: 0).map { xTicks[$0] }
  }

  /// Where a tick's number centers, kept inside the drawing as main's `clampLabelCenter`.
  func tickCenter(_ tick: Tick, textWidth: Double) -> Double {
    let half = (textWidth + Self.labelGap) / 2
    let x = Self.position(tick.value, domain: scale.x.domain, range: left...plotRight)

    return min(max(x, half), width - half)
  }

  func y(_ value: Double) -> Double {
    Self.position(value, domain: scale.y.domain, range: Self.top...plotBottom, flipped: true)
  }

  /// A dotted series draws every point; a bare line draws its shape once, at its end, beside others.
  static func drawsDot(index: Int, mark: LessonPlot.Mark, pointCount: Int, seriesCount: Int)
    -> Bool
  {
    mark != .line || (seriesCount > 1 && index == pointCount - 1)
  }

  private static func isLarge(_ values: [Double]) -> Bool {
    (values.map(abs).max() ?? 0) >= compactFrom
  }

  /// A flat domain maps everything to the middle, as main's `createLinearScale`.
  private static func position(
    _ value: Double, domain: ClosedRange<Double>, range: ClosedRange<Double>, flipped: Bool = false
  ) -> Double {
    let span = domain.upperBound - domain.lowerBound
    let (start, end) =
      flipped ? (range.upperBound, range.lowerBound) : (range.lowerBound, range.upperBound)

    return span == 0
      ? (start + end) / 2 : start + (value - domain.lowerBound) / span * (end - start)
  }

  /// Main's `wrapLabel`: lines at spaces and hyphens, a word too wide broken by characters.
  static func wrap(_ label: String, room: Double, labelWidth: (String) -> Double) -> [String] {
    let words = LessonChartNames.pieces(label).flatMap { word in
      word.reduce(into: [""]) { pieces, character in
        let piece = pieces[pieces.count - 1] + String(character)
        if pieces[pieces.count - 1].isEmpty || labelWidth(piece.trimmed) <= room {
          pieces[pieces.count - 1] = piece
        } else {
          pieces.append(String(character))
        }
      }
    }
    let lines = words.reduce(into: [""]) { lines, word in
      let line = lines[lines.count - 1] + word
      if labelWidth(line.trimmed) <= room {
        lines[lines.count - 1] = line
      } else {
        lines.append(word)
      }
    }

    return lines.map(\.trimmed).filter { !$0.isEmpty }
  }

  /// Stacks names top to bottom so close lines don't overlap, then lifts them back above the x
  /// axis's numbers.
  private static func stack(_ marks: [Reference], bottom: Double) -> [Reference] {
    let height = { (mark: Reference) in Double(mark.lines.count) * lineHeight }
    let stacked = marks.sorted { $0.y < $1.y }.reduce(into: [Reference]()) { stacked, mark in
      let floor = stacked.last.map { $0.top + height($0) + referenceSpacing } ?? 0
      stacked.append(Reference(lines: mark.lines, top: max(mark.top, floor), y: mark.y))
    }
    let overflow = stacked.last.map { $0.top + height($0) - bottom } ?? 0

    return overflow > 0
      ? stacked.map { Reference(lines: $0.lines, top: $0.top - overflow, y: $0.y) } : stacked
  }

  struct Scene {
    let bounds: Box
    let dots: [Pixel]
    let segments: [(Pixel, Pixel)]
  }

  /// Main's `getPointLabels`: every labeled point keeps its label. Names go beside their dots where
  /// there's room; when one can't fit without covering another dot or label, every name moves to a
  /// numbered key and the dots carry the numbers. Names as short as a number stay put.
  static func pointLabels(
    named: [(dot: Pixel, text: String)], scene: Scene, textWidth: (String) -> Double
  ) -> (labels: [Label], key: [KeyEntry]) {
    let direct = place(named, scene: scene, textWidth: textWidth)

    if named.allSatisfy({ $0.text.count <= maxKeyMarkerLength }) || direct.allSatisfy(\.placed) {
      return (direct.map(\.label), [])
    }

    let key = named.enumerated().map {
      KeyEntry(marker: "\($0.offset + 1)", label: $0.element.text)
    }
    let markers = named.enumerated().map { (dot: $0.element.dot, text: key[$0.offset].marker) }

    return (place(markers, scene: scene, textWidth: textWidth).map(\.label), key)
  }

  /// Takes the first side that stays inside the plot and covers no dot or earlier label, preferring
  /// one that crosses the fewest lines.
  private static func place(
    _ named: [(dot: Pixel, text: String)], scene: Scene, textWidth: (String) -> Double
  ) -> [(label: Label, placed: Bool)] {
    var taken = scene.dots.map {
      Box(
        left: $0.x - dotRadius, top: $0.y - dotRadius, right: $0.x + dotRadius,
        bottom: $0.y + dotRadius)
    }

    return named.map { dot, text in
      let width = textWidth(text)
      let options = candidates(dot: dot, text: text).map {
        (label: $0, box: box(of: $0, width: width))
      }
      let free = options.enumerated()
        .filter { _, option in
          inside(option.box, scene.bounds) && !taken.contains { overlaps(option.box, $0) }
        }
        .map { order, option in
          (
            option: option, order: order,
            crossings: scene.segments.filter { crosses($0, option.box) }.count
          )
        }
        .sorted { ($0.crossings, $0.order) < ($1.crossings, $1.order) }
      let best = free.first?.option ?? options[0]

      taken.append(best.box)
      return (best.label, !free.isEmpty)
    }
  }

  /// Beside the dot first, then above and below it, so a label reads as its dot's name.
  private static func candidates(dot: Pixel, text: String) -> [Label] {
    let above = dot.y - labelOffset - lineHeight / 2
    let below = dot.y + labelOffset + lineHeight / 2

    return [
      Label(text: text, anchor: .start, x: dot.x + labelOffset, y: dot.y),
      Label(text: text, anchor: .end, x: dot.x - labelOffset, y: dot.y),
      Label(text: text, anchor: .middle, x: dot.x, y: above),
      Label(text: text, anchor: .middle, x: dot.x, y: below),
      Label(text: text, anchor: .start, x: dot.x + dotRadius, y: above),
      Label(text: text, anchor: .end, x: dot.x - dotRadius, y: above),
      Label(text: text, anchor: .start, x: dot.x + dotRadius, y: below),
      Label(text: text, anchor: .end, x: dot.x - dotRadius, y: below),
    ]
  }

  private static func box(of label: Label, width: Double) -> Box {
    let start =
      switch label.anchor {
      case .start: label.x
      case .middle: label.x - width / 2
      case .end: label.x - width
      }

    return Box(
      left: start, top: label.y - lineHeight / 2, right: start + width,
      bottom: label.y + lineHeight / 2)
  }

  private static func inside(_ box: Box, _ bounds: Box) -> Bool {
    box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top
      && box.bottom <= bounds.bottom
  }

  private static func overlaps(_ a: Box, _ b: Box) -> Bool {
    a.left < b.right + clearance && b.left < a.right + clearance && a.top < b.bottom + clearance
      && b.top < a.bottom + clearance
  }

  /// Clips the segment to the box's x range, then checks the clipped part's y span against it.
  static func crosses(_ segment: (Pixel, Pixel), _ box: Box) -> Bool {
    let (from, to) = segment
    let low = max(min(from.x, to.x), box.left)
    let high = min(max(from.x, to.x), box.right)

    guard low <= high else { return false }

    let yAt = { (x: Double) in from.y + (x - from.x) / (to.x - from.x) * (to.y - from.y) }
    let ys = to.x == from.x ? [from.y, to.y] : [yAt(low), yAt(high)]

    return (ys.max() ?? 0) >= box.top && (ys.min() ?? 0) <= box.bottom
  }
}

extension String {
  fileprivate var trimmed: String { trimmingCharacters(in: .whitespaces) }
}
