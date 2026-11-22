import Foundation

/// Main's `plot-layout`, in points for 12-point labels; a larger text size scales the whole drawing by
/// `scale`. `text` measures a label at 12 points, and `name` a point's name, drawn in medium weight.
struct LessonPlotLayout {
  static let height = 208.0
  /// The narrowest plot area that still keeps its x numbers and its points' names readable.
  static let minPlotWidth = 72.0
  static let top = 22.0
  static let bottom = 26.0
  static let minLeft = 48.0
  static let right = 8.0
  static let labelGap = 6.0
  static let lineHeight = 14.0
  static let tickOffset = 16.0
  static let dotRadius = 4.5
  static let haloWidth = 3.0
  static let referenceInset = dotRadius + labelGap
  private static let labelOffset = dotRadius + 3
  private static let clearance = 1.0
  private static let maxKeyMarkerLength = 2
  private static let maxGutterShare = 0.3
  private static let referenceSpacing = 2.0
  private static let maxNameShift = lineHeight / 2
  private static let cornerClearance = 2.0
  private static let gridSnap = 1.0

  struct Measure {
    let text: (String) -> Double
    let name: (String) -> Double

    func labelWidth(_ label: String) -> Double { text(label) + LessonPlotLayout.labelGap }
  }

  /// `line` is off where a reference line runs on it, so the line keeps its dashes.
  struct Tick {
    let label: String
    let value: Double
    var line = true
  }

  struct PlacedTick {
    let label: String
    let value: Double
    let center: Double
  }

  /// `top` is its first line's top and `x` where its text starts; a numbered line's name is in the key.
  struct Reference {
    let label: String
    let lines: [String]
    let top: Double
    let x: Double
    let y: Double
  }

  private struct PlannedMark {
    let label: String
    let lines: [String]
    var top: Double
    let y: Double
    let offset: Double

    var height: Double { Double(lines.count) * LessonPlotLayout.lineHeight }
  }

  private struct ReferencePlan {
    let key: [KeyEntry]
    let marks: [PlannedMark]
    let width: Double
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
  let xTicks: [PlacedTick]
  let yTicks: [Tick]
  let series: [[Pixel]]
  let references: [Reference]
  let labels: [Label]
  let key: [KeyEntry]
  let scale: LessonPlotScale

  init(
    _ plot: LessonPlot, width: Double, measure: Measure, locale: Locale = .courseLanguage
  ) {
    let scale = LessonPlotScale(plot)
    let gutters = Gutters(plot, scale: scale, measure: measure, locale: locale)
    let left = gutters.left
    let plotBottom = Self.height - Self.bottom
    let toY = { (y: Double) in
      Self.position(y, domain: scale.y.domain, range: Self.top...plotBottom, flipped: true)
    }
    let plan = Self.planReferences(
      plot.references, left: left, width: width, measure: measure, y: toY)
    let plotRight = max(width - plan.width, left + 1)
    let toX = { (x: Double) in Self.position(x, domain: scale.x.domain, range: left...plotRight) }

    self.scale = scale
    self.left = left
    self.plotRight = plotRight
    self.plotBottom = plotBottom

    let series = plot.series.map { $0.points.map { Pixel(x: toX($0.x), y: toY($0.y)) } }
    self.series = series

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
    let rules = plan.marks.map { (Pixel(x: left, y: $0.y), Pixel(x: plotRight, y: $0.y)) }
    let named = plot.series.enumerated().flatMap { seriesIndex, item in
      item.points.enumerated().compactMap { index, point in
        point.label.map { (dot: series[seriesIndex][index], text: $0) }
      }
    }

    let placed = Self.pointLabels(
      named: named,
      scene: Scene(
        bounds: Box(
          left: left, top: 0, right: plan.marks.isEmpty ? width : plotRight, bottom: plotBottom),
        dots: dots, segments: lines + rules),
      textWidth: measure.name, firstMarker: plan.key.count + 1)
    labels = placed.labels
    key = plan.key + placed.key

    references = plan.marks.map {
      Reference(
        label: $0.label, lines: $0.lines, top: $0.top,
        x: plotRight + Self.referenceInset + $0.offset, y: $0.y)
    }
    yTicks = gutters.yTicks.map { tick in
      Tick(
        label: tick.label, value: tick.value,
        line: plan.marks.allSatisfy { abs($0.y - toY(tick.value)) >= Self.gridSnap })
    }

    // Each number sits centered under its value. The first or last one is left out when it would
    // reach the y axis's numbers or past the drawing's edge, and the rest thin out evenly when they
    // would touch.
    let xLabels = LessonPlotTicks.format(
      scale.x.ticks, xAxis: true,
      unit: LessonChartUnit.place(plot.xUnit, label: plot.xLabel).numberUnit,
      locale: locale)
    let xPlaced = zip(scale.x.ticks, xLabels).map { value, label in
      PlacedTick(label: label, value: value, center: toX(value))
    }.filter { tick in
      let half = measure.text(tick.label) / 2
      return tick.center - half >= left - Self.labelGap + Self.cornerClearance
        && tick.center + half <= width
    }
    let frames = xPlaced.map { tick in
      let half = measure.text(tick.label) / 2
      return (left: tick.center - half, right: tick.center + half)
    }
    xTicks = LessonChartTicks.labeled(frames, gap: Self.labelGap).map { xPlaced[$0] }
  }

  /// The drawing's text grows with the reader's text size until the plot area would get narrower
  /// than `minPlotWidth`, counting reference names wrapped as narrow as their widest word; the text
  /// around the drawing keeps growing.
  static func scale(
    _ plot: LessonPlot, text: Double, width: Double, measure: Measure,
    locale: Locale = .courseLanguage
  ) -> Double {
    let gutters = Gutters(plot, scale: LessonPlotScale(plot), measure: measure, locale: locale)
    let named = !plot.references.isEmpty
    let fixed = gutters.left + (named ? referenceInset : right) + minPlotWidth
    let minWidth =
      named
      ? min(fixed + gutters.longest, max(fixed / (1 - maxGutterShare), fixed + gutters.widestWord))
      : fixed

    return min(text, max(width / minWidth, 1))
  }

  func y(_ value: Double) -> Double {
    Self.position(value, domain: scale.y.domain, range: Self.top...plotBottom, flipped: true)
  }

  /// A bare line marks its end with its series' shape only when there are other series to tell it
  /// from.
  static func drawsDot(index: Int, mark: LessonPlot.Mark, pointCount: Int, seriesCount: Int)
    -> Bool
  {
    mark != .line || (seriesCount > 1 && index == pointCount - 1)
  }

  /// The y axis's numbers on the left and the reference names on the right, which keep their size
  /// at any width.
  private struct Gutters {
    let yTicks: [Tick]
    let left: Double
    /// The widest reference name on one line, and the widest word in one, which a wrap never breaks.
    let longest: Double
    let widestWord: Double

    init(_ plot: LessonPlot, scale: LessonPlotScale, measure: Measure, locale: Locale) {
      let names = plot.references.map(\.label)

      let yUnit = LessonChartUnit.place(plot.yUnit, label: plot.yLabel).numberUnit
      yTicks = zip(
        scale.y.ticks, LessonPlotTicks.format(scale.y.ticks, unit: yUnit, locale: locale)
      )
      .map { Tick(label: $1, value: $0) }
      left = max(LessonPlotLayout.minLeft, yTicks.map { measure.labelWidth($0.label) }.max() ?? 0)
      longest = names.map(measure.labelWidth).max() ?? 0
      widestWord = LessonPlotLayout.widestWord(names, labelWidth: measure.labelWidth)
    }
  }

  private static func widestWord(_ labels: [String], labelWidth: (String) -> Double) -> Double {
    labels.flatMap(LessonChartNames.pieces).map { labelWidth($0.trimmed) }.max() ?? 0
  }

  private static func planReferences(
    _ references: [LessonPlot.Reference], left: Double, width: Double, measure: Measure,
    y: (Double) -> Double
  ) -> ReferencePlan {
    guard !references.isEmpty else {
      return ReferencePlan(key: [], marks: [], width: right)
    }

    let available = width - left - referenceInset - minPlotWidth

    return nameReferences(references, available: available, width: width, measure: measure, y: y)
      ?? numberReferences(references, measure: measure, y: y)
  }

  /// Names sit past the plot's right edge, level with their lines and clear of a point drawn on
  /// that edge. A name wraps to a share of the width, never inside a word and never taking the plot
  /// below its narrowest; it can't be named there when even its widest word doesn't fit, or when
  /// names stacked apart would sit off their lines by more than half a line.
  private static func nameReferences(
    _ references: [LessonPlot.Reference], available: Double, width: Double, measure: Measure,
    y: (Double) -> Double
  ) -> ReferencePlan? {
    let names = references.map(\.label)
    let widestWord = widestWord(names, labelWidth: measure.labelWidth)

    guard widestWord <= available else {
      return nil
    }

    let longest = names.map(measure.labelWidth).max() ?? 0
    let room = min(longest, max(width * maxGutterShare, widestWord), available)
    let marks = references.map { reference in
      let lines = wrap(reference.label, room: room, labelWidth: measure.labelWidth)
      let lineY = y(reference.y)

      return PlannedMark(
        label: reference.label, lines: lines,
        top: lineY - Double(lines.count) * lineHeight / 2, y: lineY, offset: 0)
    }
    let stacked = stack(marks, bottom: height - bottom)

    guard stacked.allSatisfy({ abs($0.top + $0.height / 2 - $0.y) <= maxNameShift }) else {
      return nil
    }

    let widestLine = stacked.flatMap(\.lines).map(measure.labelWidth).max() ?? 0

    return ReferencePlan(key: [], marks: stacked, width: referenceInset + widestLine)
  }

  /// Each line carries a number, from the top line down, level with its line; numbers of lines
  /// closer than a line of text sit side by side instead of stacking off their lines.
  private static func numberReferences(
    _ references: [LessonPlot.Reference], measure: Measure, y: (Double) -> Double
  ) -> ReferencePlan {
    let markerWidth = measure.labelWidth(String(references.count))
    var columns: [Double] = []
    let sorted = references.map { (label: $0.label, y: y($0.y)) }.sorted { $0.y < $1.y }
    let marks = sorted.enumerated().map { index, reference in
      let column =
        columns.firstIndex { reference.y - $0 >= lineHeight } ?? columns.count

      if column == columns.count {
        columns.append(reference.y)
      } else {
        columns[column] = reference.y
      }

      return PlannedMark(
        label: reference.label, lines: [String(index + 1)], top: reference.y - lineHeight / 2,
        y: reference.y, offset: Double(column) * markerWidth)
    }

    return ReferencePlan(
      key: marks.map { KeyEntry(marker: $0.lines[0], label: $0.label) }, marks: marks,
      width: referenceInset + Double(columns.count) * markerWidth)
  }

  private static func position(
    _ value: Double, domain: ClosedRange<Double>, range: ClosedRange<Double>, flipped: Bool = false
  ) -> Double {
    let span = domain.upperBound - domain.lowerBound
    let (start, end) =
      flipped ? (range.upperBound, range.lowerBound) : (range.lowerBound, range.upperBound)

    return span == 0
      ? (start + end) / 2 : start + (value - domain.lowerBound) / span * (end - start)
  }

  /// Breaks at spaces and hyphens, and inside a word only when it's wider than `room`.
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

  private static func stack(_ marks: [PlannedMark], bottom: Double) -> [PlannedMark] {
    let stacked = marks.sorted { $0.y < $1.y }.reduce(into: [PlannedMark]()) { stacked, mark in
      var mark = mark
      mark.top = max(mark.top, stacked.last.map { $0.top + $0.height + referenceSpacing } ?? 0)
      stacked.append(mark)
    }
    let overflow = stacked.last.map { $0.top + $0.height - bottom } ?? 0

    return overflow > 0
      ? stacked.map {
        var mark = $0
        mark.top -= overflow
        return mark
      } : stacked
  }

  struct Scene {
    let bounds: Box
    let dots: [Pixel]
    let segments: [(Pixel, Pixel)]
  }

  /// Every labeled point keeps its name: beside its dot where there's room, and when one can't fit
  /// without covering another dot or name, every name moves to a numbered key counting from
  /// `firstMarker`, and the dots carry the numbers. Names as short as a number gain nothing from a
  /// key, so they stay put.
  static func pointLabels(
    named: [(dot: Pixel, text: String)], scene: Scene, textWidth: (String) -> Double,
    firstMarker: Int = 1
  ) -> (labels: [Label], key: [KeyEntry]) {
    let direct = place(named, scene: scene, textWidth: textWidth)

    if named.allSatisfy({ $0.text.count <= maxKeyMarkerLength }) || direct.allSatisfy(\.placed) {
      return (direct.map(\.label), [])
    }

    let key = named.enumerated().map {
      KeyEntry(marker: "\(firstMarker + $0.offset)", label: $0.element.text)
    }
    let markers = named.enumerated().map { (dot: $0.element.dot, text: key[$0.offset].marker) }

    return (place(markers, scene: scene, textWidth: textWidth).map(\.label), key)
  }

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
      let dotBox = Box(
        left: dot.x - dotRadius, top: dot.y - dotRadius, right: dot.x + dotRadius,
        bottom: dot.y + dotRadius)
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
            // The label with the gap to its dot: a line through it, such as a reference, would part
            // them.
            crossings: scene.segments.filter { crosses($0, span(option.box, dotBox)) }.count
          )
        }
        .sorted { ($0.crossings, $0.order) < ($1.crossings, $1.order) }
      let best = free.first?.option ?? options[0]

      taken.append(best.box)
      return (best.label, !free.isEmpty)
    }
  }

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

  private static func span(_ a: Box, _ b: Box) -> Box {
    Box(
      left: min(a.left, b.left), top: min(a.top, b.top), right: max(a.right, b.right),
      bottom: max(a.bottom, b.bottom))
  }

  private static func inside(_ box: Box, _ bounds: Box) -> Bool {
    box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top
      && box.bottom <= bounds.bottom
  }

  private static func overlaps(_ a: Box, _ b: Box) -> Bool {
    a.left < b.right + clearance && b.left < a.right + clearance && a.top < b.bottom + clearance
      && b.top < a.bottom + clearance
  }

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
