import SwiftUI

/// Where a note or rest is in the tune: its bar and its place in it.
struct NotationElementID: Hashable, Sendable {
  let bar: Int
  let index: Int
}

/// A tune laid out on staves at a width: filled shapes, strokes and short texts, each tagged with
/// the note it belongs to so the one playing can light up. Lines wrap a few bars at a time, as
/// main's abcjs staves do (two bars a line on a phone, four when wide), and every line but a short
/// last one is spread to the full width.
struct NotationDrawing: Sendable {
  enum TextKind: Sendable {
    case chordSymbol, tabFret, tupletNumber, endingNumber
  }

  enum Mark: Sendable {
    case fill(Path)
    case stroke(Path, width: CGFloat)
    case text(String, at: CGPoint, kind: TextKind)
  }

  struct Item: Sendable {
    let mark: Mark
    var element: NotationElementID?
  }

  var items: [Item] = []
  var height: CGFloat = 0
}

extension NotationDrawing {
  /// Lays `tune` out at `width`, with staff lines `space` apart and, for tab, the six strings
  /// `tabSpace` apart under each staff. `textHeight` is a line of the texts' font, so a line of
  /// music leaves room for its chord symbols at any text size.
  init(tune: ABCTune, width: CGFloat, space: CGFloat, tabSpace: CGFloat?, textHeight: CGFloat) {
    var layout = NotationLayout(
      tune: tune, width: width, space: space, tabSpace: tabSpace, textHeight: textHeight)
    self = layout.draw()
  }
}

/// The engraving rules: spacing by length, stems and beams, ledger lines, accidentals and dots,
/// ties and tuplet numbers, bar lines with repeats and endings, and tab under the staff.
private struct NotationLayout {
  let tune: ABCTune
  let width: CGFloat
  let space: CGFloat
  let tabSpace: CGFloat?
  let textHeight: CGFloat

  /// The key signature in force: the tune's, until a bar changes it.
  private var fifths: Int

  private var items: [NotationDrawing.Item] = []
  private var scale: CGFloat { space / MusicGlyph.staffSpace }
  private var stemWidth: CGFloat { max(space * 0.12, 1) }
  private var lineWidth: CGFloat { max(space * 0.1, 0.75) }

  /// Bars a line holds at most: two on a phone, four when there's room.
  private var preferredBars: Int { width < 480 ? 2 : 4 }

  /// The bottom line of the staff: E4 on a treble staff, G2 on a bass staff.
  private var bottomStep: Int { tune.clef == .treble ? 30 : 18 }

  init(tune: ABCTune, width: CGFloat, space: CGFloat, tabSpace: CGFloat?, textHeight: CGFloat) {
    self.tune = tune
    self.width = width
    self.space = space
    self.tabSpace = tabSpace
    self.textHeight = textHeight
    fifths = tune.fifths
  }

  // MARK: - Lines

  mutating func draw() -> NotationDrawing {
    let lines = breakLines()
    var top: CGFloat = 0
    var previousStretch: CGFloat?

    for (number, line) in lines.enumerated() {
      let start = items.count
      let isLast = number == lines.count - 1
      previousStretch = drawLine(
        line, isFirst: number == 0, isLast: isLast, previous: previousStretch)

      var extent = CGRect.null

      for item in items[start...] {
        extent = extent.union(bounds(of: item.mark))
      }

      let shift = top - extent.minY
      let move = CGAffineTransform(translationX: 0, y: shift)

      for index in start..<items.count {
        items[index] = Self.moved(items[index], by: move, dy: shift)
      }

      top += extent.height + space * 2.5
    }

    return NotationDrawing(items: items, height: max(top - space * 2.5, 0))
  }

  /// Bars that fit a line, up to the preferred number.
  private func breakLines() -> [[Int]] {
    let drawn = tune.bars.indices.filter { !tune.bars[$0].elements.isEmpty }
    var lines: [[Int]] = []
    var current: [Int] = []
    var used = headerWidth(isFirst: true)

    for bar in drawn {
      let barWidth = idealWidth(of: bar)

      if !current.isEmpty, current.count >= preferredBars || used + barWidth > width {
        lines.append(current)
        current = []
        used = headerWidth(isFirst: false)
      }

      current.append(bar)
      used += barWidth
    }

    if !current.isEmpty {
      lines.append(current)
    }

    return lines
  }

  private var keyWidth: CGFloat {
    tune.fifths == 0 ? 0 : CGFloat(abs(tune.fifths)) * space * 1.05 + space * 0.6
  }

  private func headerWidth(isFirst: Bool) -> CGFloat {
    let clef = space * 3.4
    let meter: CGFloat = isFirst && tune.meter != .none ? space * 2.4 : 0
    return clef + keyWidth + meter
  }

  /// Room for a note of `length` whole notes: an eighth gets 2.6 spaces, each doubling about 1.4
  /// times more, as engravers space by the square root of the length.
  private func idealSpace(_ length: Double) -> CGFloat {
    space * 2.6 * CGFloat((max(length, 1.0 / 64) / 0.125).squareRoot())
  }

  private func minimumSpace(_ element: ABCTune.Element) -> CGFloat {
    let hasAccidental = element.pitches.contains { $0.accidental != nil }
    let dots = CGFloat(Self.noteType(element.written).dots)
    return space * (1.9 + (hasAccidental ? 1.2 : 0) + dots * 0.6)
  }

  private func elementWidth(_ element: ABCTune.Element) -> CGFloat {
    max(idealSpace(element.written), minimumSpace(element))
  }

  private func idealWidth(of bar: Int) -> CGFloat {
    tune.bars[bar].elements.reduce(space * 1.6) { $0 + elementWidth($1) }
      + (tune.bars[bar].startsRepeat ? space * 1.5 : 0)
      + (tune.bars[bar].fifths.map { CGFloat(abs($0)) * space * 1.05 + space * 1.1 } ?? 0)
  }

  /// Draws one line and returns how much it stretched its bars: full lines fill the width, and
  /// a short last line keeps the spacing of the line before it.
  private mutating func drawLine(_ bars: [Int], isFirst: Bool, isLast: Bool, previous: CGFloat?)
    -> CGFloat
  {
    if let first = bars.first, let change = tune.bars[first].fifths {
      fifths = change
    }

    var x = drawHeader(isFirst: isFirst)
    let natural = bars.reduce(0) { $0 + idealWidth(of: $1) }
    let fill = (width - x) / max(natural, 1)
    let stretch: CGFloat =
      if !isLast || fill <= 1 {
        fill
      } else if let previous {
        min(fill, previous)
      } else {
        natural >= (width - x) * 0.6 ? fill : 1
      }

    for bar in bars {
      x = drawBar(bar, from: x, stretch: stretch, startsLine: bar == bars.first)
    }

    drawStaff(to: x)

    if let tabSpace {
      drawTabLines(to: x, tabSpace: tabSpace)
    }

    return stretch
  }

  // MARK: - Staff

  /// The height of staff position `position`, in half spaces up from the bottom line.
  private func y(_ position: Int) -> CGFloat {
    space * 4 - CGFloat(position) * space / 2
  }

  private func position(of step: Int) -> Int {
    step - bottomStep
  }

  private mutating func drawStaff(to end: CGFloat) {
    for line in 0..<5 {
      add(
        .fill(
          Path(
            CGRect(x: 0, y: CGFloat(line) * space - lineWidth / 2, width: end, height: lineWidth))))
    }

    add(.fill(Path(CGRect(x: 0, y: 0, width: lineWidth * 1.5, height: space * 4))))
  }

  private var tabTop: CGFloat { space * 7.5 }

  private mutating func drawTabLines(to end: CGFloat, tabSpace: CGFloat) {
    add(.fill(Path(CGRect(x: 0, y: tabTop, width: lineWidth * 1.5, height: tabSpace * 5))))

    for line in 0..<6 {
      let lineY = tabTop + CGFloat(line) * tabSpace
      add(.fill(Path(CGRect(x: 0, y: lineY - lineWidth / 2, width: end, height: lineWidth))))
    }
  }

  private mutating func glyph(
    _ glyph: MusicGlyph, x: CGFloat, y: CGFloat, element: NotationElementID? = nil
  ) {
    let transform = CGAffineTransform(translationX: x, y: y).scaledBy(x: scale, y: scale)
    add(.fill(glyph.path.applying(transform)), element: element)
  }

  private mutating func drawHeader(isFirst: Bool) -> CGFloat {
    var x = space * 0.5

    if tune.clef == .treble {
      glyph(.trebleClef, x: x, y: y(2))
    } else {
      glyph(.bassClef, x: x, y: y(6))
    }

    x = drawKeySignature(at: space * 3.4)

    if isFirst {
      x = drawMeter(at: x)
    }

    return x
  }

  /// The sharps or flats of the key in force, on their lines; returns where the music goes on.
  private mutating func drawKeySignature(at start: CGFloat) -> CGFloat {
    let sharps = [8, 5, 9, 6, 3, 7, 4]
    let flats = [4, 7, 3, 6, 2, 5, 1]
    let offset = tune.clef == .treble ? 0 : -2
    var x = start

    for index in 0..<abs(fifths) {
      let position = (fifths > 0 ? sharps : flats)[index] + offset
      glyph(fifths > 0 ? .sharp : .flat, x: x, y: y(position))
      x += space * 1.05
    }

    return fifths == 0 ? x : x + space * 0.6
  }

  private mutating func drawMeter(at start: CGFloat) -> CGFloat {
    switch tune.meter {
    case .none:
      return start
    case .common:
      glyph(.commonTime, x: start, y: y(4))
    case .cut:
      glyph(.cutTime, x: start, y: y(4))
    case .fraction(let num, let den):
      let top = Self.digits(num)
      let bottom = Self.digits(den)
      let topWidth = top.reduce(0) { $0 + $1.width } * scale
      let bottomWidth = bottom.reduce(0) { $0 + $1.width } * scale
      let widest = max(topWidth, bottomWidth)

      var x = start + (widest - topWidth) / 2
      for digit in top {
        glyph(digit, x: x, y: y(4))
        x += digit.width * scale
      }

      x = start + (widest - bottomWidth) / 2
      for digit in bottom {
        glyph(digit, x: x, y: y(0))
        x += digit.width * scale
      }
    }

    return start + space * 2.4
  }

  private static func digits(_ number: Int) -> [MusicGlyph] {
    let all: [MusicGlyph] = [
      .digit0, .digit1, .digit2, .digit3, .digit4, .digit5, .digit6, .digit7, .digit8, .digit9,
    ]

    return String(number).compactMap { $0.wholeNumberValue.map { all[$0] } }
  }

  // MARK: - Bars

  private struct Placed {
    let id: NotationElementID
    let element: ABCTune.Element
    let x: CGFloat
    let headWidth: CGFloat
  }

  private mutating func drawBar(_ bar: Int, from start: CGFloat, stretch: CGFloat, startsLine: Bool)
    -> CGFloat
  {
    let data = tune.bars[bar]
    var x = start

    // A key change mid-line shows its new signature where it starts; at a line's start the
    // header already shows it.
    if let change = data.fifths, !startsLine {
      fifths = change
      x = drawKeySignature(at: x + space * 0.5)
    }

    if data.startsRepeat {
      add(.fill(Path(CGRect(x: x + space * 0.2, y: 0, width: space * 0.45, height: space * 4))))
      add(.fill(Path(CGRect(x: x + space * 0.85, y: 0, width: stemWidth, height: space * 4))))
      repeatDots(at: x + space * 1.35)
      x += space * 1.5
    }

    x += space * 1.0 * stretch
    var placed: [Placed] = []

    for (index, element) in data.elements.enumerated() {
      let width = elementWidth(element) * stretch
      let hasAccidental = element.pitches.contains { $0.accidental != nil }
      let headX = x + (hasAccidental ? space * 1.2 : 0)
      let type = Self.noteType(element.written)
      let head = element.isRest ? 0 : Self.head(for: type.base).width * scale
      placed.append(
        Placed(
          id: NotationElementID(bar: bar, index: index), element: element, x: headX, headWidth: head
        ))
      x += width
    }

    let barEnd = x + space * 0.6 * stretch

    drawElements(placed, barEnd: barEnd)
    drawBarLine(data, at: barEnd)

    if let ending = data.ending {
      drawEnding(ending, from: start, to: barEnd)
    }

    return barEnd
  }

  private mutating func repeatDots(at x: CGFloat) {
    for position in [3, 5] {
      add(.fill(dotGlyphPath(x: x, y: y(position))))
    }
  }

  private func dotGlyphPath(x: CGFloat, y: CGFloat) -> Path {
    MusicGlyph.dot.path.applying(
      CGAffineTransform(translationX: x, y: y).scaledBy(x: scale, y: scale))
  }

  private mutating func drawBarLine(_ bar: ABCTune.Bar, at x: CGFloat) {
    let thin = stemWidth
    let thick = space * 0.45

    if let tabSpace {
      add(.fill(Path(CGRect(x: x - thin, y: tabTop, width: thin, height: tabSpace * 5))))
    }

    if bar.endsRepeat {
      repeatDots(at: x - space * 1.6)
      add(.fill(Path(CGRect(x: x - space * 0.95, y: 0, width: thin, height: space * 4))))
      add(.fill(Path(CGRect(x: x - thick, y: 0, width: thick, height: space * 4))))
      return
    }

    switch bar.end {
    case .double:
      add(.fill(Path(CGRect(x: x - space * 0.5, y: 0, width: thin, height: space * 4))))
      add(.fill(Path(CGRect(x: x - thin, y: 0, width: thin, height: space * 4))))
    case .final:
      add(.fill(Path(CGRect(x: x - space * 0.85, y: 0, width: thin, height: space * 4))))
      add(.fill(Path(CGRect(x: x - thick, y: 0, width: thick, height: space * 4))))
    case .single, .none:
      add(.fill(Path(CGRect(x: x - thin, y: 0, width: thin, height: space * 4))))
    }
  }

  private mutating func drawEnding(_ ending: Int, from start: CGFloat, to end: CGFloat) {
    let top = -space * 3.2
    var bracket = Path()
    bracket.move(to: CGPoint(x: start + space * 0.3, y: top + space * 1.4))
    bracket.addLine(to: CGPoint(x: start + space * 0.3, y: top))
    bracket.addLine(to: CGPoint(x: end - space * 0.3, y: top))
    add(.stroke(bracket, width: stemWidth))
    add(
      .text(
        "\(ending).", at: CGPoint(x: start + space * 0.8, y: top + space * 0.2), kind: .endingNumber
      ))
  }

  // MARK: - Notes

  /// A written length as a note type and its dots: 3/8 is a dotted quarter.
  static func noteType(_ length: Double) -> (base: Double, dots: Int) {
    for base in [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125] {
      for dots in 0...2 where abs(base * (2 - pow(0.5, Double(dots))) - length) < 1e-6 {
        return (base, dots)
      }
    }

    let base = [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125].first { $0 <= length + 1e-9 } ?? 0.03125
    return (base, 0)
  }

  private static func head(for base: Double) -> MusicGlyph {
    base >= 1 ? .wholeNote : base >= 0.5 ? .halfNote : .blackNote
  }

  /// Flags (or beams) a note type has: an eighth has one.
  private static func flagCount(_ base: Double) -> Int {
    base <= 0.03125 ? 3 : base <= 0.0625 ? 2 : base <= 0.125 ? 1 : 0
  }

  private mutating func drawElements(_ placed: [Placed], barEnd: CGFloat) {
    var beamed = Set<Int>()

    for group in beamGroups(placed) {
      drawBeamGroup(group.map { placed[$0] })
      beamed.formUnion(group)
    }

    for (index, item) in placed.enumerated() {
      if item.element.isRest {
        drawRest(item)
      } else {
        drawNote(item, hasBeam: beamed.contains(index))
      }

      if let symbol = item.element.chordSymbol {
        add(
          .text(
            symbol, at: CGPoint(x: item.x, y: min(-space * 1.4, topOfNote(item) - space * 1.2)),
            kind: .chordSymbol),
          element: item.id)
      }

      if let tuplet = item.element.tuplet {
        let last = placed[min(index + tuplet.count - 1, placed.count - 1)]
        let isUp = stemsUp(
          placed[index...min(index + tuplet.count - 1, placed.count - 1)].map(\.element))
        let centerX = (item.x + last.x + last.headWidth) / 2
        let edge =
          isUp
          ? min(topOfNote(item), topOfNote(last)) - space * 1.6
          : max(bottomOfNote(item), bottomOfNote(last)) + space * 1.2
        add(.text("\(tuplet.number)", at: CGPoint(x: centerX, y: edge), kind: .tupletNumber))
      }

      // A tie over the bar line reaches it; the next bar's note carries on the sound.
      for pitch in item.element.pitches where pitch.isTied {
        drawTie(
          from: item, pitch: pitch,
          toX: index + 1 < placed.count ? placed[index + 1].x - space * 0.2 : barEnd - space * 0.3)
      }
    }

    if tabSpace != nil {
      for item in placed where !item.element.isRest {
        drawTab(item)
      }
    }
  }

  private func positions(_ element: ABCTune.Element) -> [Int] {
    element.pitches.map { position(of: $0.step) }.sorted()
  }

  private func stemsUp(_ elements: [ABCTune.Element]) -> Bool {
    let all = elements.flatMap(positions)
    guard !all.isEmpty else { return true }
    let average = Double(all.reduce(0, +)) / Double(all.count)
    return average < 4
  }

  private func topOfNote(_ item: Placed) -> CGFloat {
    let positions = positions(item.element)
    let headTop = y(positions.last ?? 4) - space * 0.5
    let type = Self.noteType(item.element.written)
    return type.base < 1 && stemsUp([item.element])
      ? min(headTop, stemEnd(item, up: true)) : min(headTop, 0)
  }

  private func bottomOfNote(_ item: Placed) -> CGFloat {
    let positions = positions(item.element)
    let headBottom = y(positions.first ?? 4) + space * 0.5
    return max(headBottom, space * 4)
  }

  private func stemLength(_ base: Double) -> CGFloat {
    space * (3.5 + CGFloat(max(Self.flagCount(base) - 1, 0)) * 0.75)
  }

  /// Where a lone note's stem ends: three and a half spaces from its outer head, and at least to
  /// the middle line for notes far off the staff.
  private func stemEnd(_ item: Placed, up: Bool) -> CGFloat {
    let positions = positions(item.element)
    let length = stemLength(Self.noteType(item.element.written).base)

    return up
      ? min(y(positions.last ?? 4) - length, y(4))
      : max(y(positions.first ?? 4) + length, y(4))
  }

  private func stemX(_ item: Placed, up: Bool) -> CGFloat {
    up ? item.x + item.headWidth - stemWidth / 2 : item.x + stemWidth / 2
  }

  private mutating func drawNote(_ item: Placed, hasBeam: Bool) {
    let type = Self.noteType(item.element.written)
    let up = stemsUp([item.element])
    let head = Self.head(for: type.base)
    let sorted = item.element.pitches.sorted { $0.step < $1.step }
    var previous: Int?
    var shifted = false

    for pitch in sorted {
      let position = position(of: pitch.step)
      // A second above (stem up) or below sits on the other side of the stem.
      shifted = previous.map { position - $0 == 1 } == true ? !shifted : false
      let offset = shifted ? (up ? item.headWidth - stemWidth : -(item.headWidth - stemWidth)) : 0
      glyph(head, x: item.x + offset, y: y(position), element: item.id)

      if let accidental = pitch.accidental {
        let mark = Self.accidentalGlyph(accidental)
        glyph(mark, x: item.x - mark.width * scale - space * 0.25, y: y(position), element: item.id)
      }

      for dot in 0..<type.dots {
        let dotPosition = position.isMultiple(of: 2) ? position + 1 : position
        add(
          .fill(
            dotGlyphPath(
              x: item.x + item.headWidth + space * (0.4 + CGFloat(dot) * 0.6), y: y(dotPosition))),
          element: item.id)
      }

      ledgerLines(position, x: item.x + offset, width: item.headWidth)
      previous = position
    }

    guard type.base < 1, !hasBeam else {
      return
    }

    let x = stemX(item, up: up)
    let outer =
      up
      ? y(sorted.first.map { position(of: $0.step) } ?? 4)
      : y(sorted.last.map { position(of: $0.step) } ?? 4)
    let end = stemEnd(item, up: up)
    add(
      .fill(
        Path(
          CGRect(
            x: x - stemWidth / 2, y: min(outer, end), width: stemWidth, height: abs(end - outer)))),
      element: item.id)

    let flags = Self.flagCount(type.base)

    if flags > 0 {
      let flag: MusicGlyph =
        switch (flags, up) {
        case (1, true): .eighthFlagUp
        case (2, true): .sixteenthFlagUp
        case (_, true): .thirtySecondFlagUp
        case (1, false): .eighthFlagDown
        case (2, false): .sixteenthFlagDown
        case (_, false): .thirtySecondFlagDown
        }
      glyph(flag, x: x - stemWidth / 2, y: end, element: item.id)
    }
  }

  private static func accidentalGlyph(_ accidental: ABCTune.Accidental) -> MusicGlyph {
    switch accidental {
    case .sharp: .sharp
    case .flat: .flat
    case .natural: .natural
    case .doubleSharp: .doubleSharp
    case .doubleFlat: .doubleFlat
    }
  }

  private mutating func ledgerLines(_ position: Int, x: CGFloat, width: CGFloat) {
    let lines =
      position <= -2
      ? Array(stride(from: -2, through: position, by: -2))
      : position >= 10 ? Array(stride(from: 10, through: position, by: 2)) : []

    for line in lines {
      add(
        .fill(
          Path(
            CGRect(
              x: x - space * 0.4, y: y(line) - lineWidth / 2, width: width + space * 0.8,
              height: lineWidth))))
    }
  }

  private mutating func drawRest(_ item: Placed) {
    guard !item.element.isInvisible else {
      return
    }

    let type = Self.noteType(item.element.written)
    let (rest, position): (MusicGlyph, Int) =
      switch type.base {
      case 1: (.wholeRest, 6)
      case 0.5: (.halfRest, 4)
      case 0.25: (.quarterRest, 4)
      case 0.125: (.eighthRest, 4)
      case 0.0625: (.sixteenthRest, 4)
      default: (.thirtySecondRest, 4)
      }

    glyph(rest, x: item.x, y: y(position), element: item.id)

    for dot in 0..<type.dots {
      add(
        .fill(
          dotGlyphPath(x: item.x + rest.width * scale + space * (0.4 + CGFloat(dot) * 0.6), y: y(5))
        ),
        element: item.id)
    }
  }

  /// Notes of an eighth or shorter, written together without a space, share beams.
  private func beamGroups(_ placed: [Placed]) -> [[Int]] {
    var groups: [[Int]] = []
    var current: [Int] = []

    for (index, item) in placed.enumerated() {
      let beamable =
        !item.element.isRest && Self.flagCount(Self.noteType(item.element.written).base) > 0

      if !beamable || item.element.breaksBeam {
        if current.count > 1 { groups.append(current) }
        current = []
      }

      if beamable {
        current.append(index)
      }
    }

    if current.count > 1 {
      groups.append(current)
    }

    return groups
  }

  private mutating func drawBeamGroup(_ group: [Placed]) {
    guard let first = group.first, let last = group.last else {
      return
    }

    let up = stemsUp(group.map(\.element))
    let firstX = stemX(first, up: up)
    let lastX = stemX(last, up: up)
    var startY = stemEnd(first, up: up)
    var endY = stemEnd(last, up: up)
    let run = max(lastX - firstX, 1)
    let maxSlope = space * 0.5 / max(run / space, 1)
    let slope = min(max((endY - startY) / run, -maxSlope / space), maxSlope / space)
    endY = startY + slope * run

    // Every stem at least two and a half spaces long.
    let shortest = space * 2.5

    for item in group {
      let positions = positions(item.element)
      let x = stemX(item, up: up)
      let beamY = startY + slope * (x - firstX)

      if up {
        let need = y(positions.last ?? 4) - shortest
        if beamY > need {
          startY -= beamY - need
          endY -= beamY - need
        }
      } else {
        let need = y(positions.first ?? 4) + shortest
        if beamY < need {
          startY += need - beamY
          endY += need - beamY
        }
      }
    }

    func beamY(at x: CGFloat) -> CGFloat {
      startY + (endY - startY) * (x - firstX) / run
    }

    let thickness = space * 0.5
    let inward: CGFloat = up ? 1 : -1

    for item in group {
      let x = stemX(item, up: up)
      let positions = positions(item.element)
      let outer = up ? y(positions.first ?? 4) : y(positions.last ?? 4)
      let end = beamY(at: x)
      add(
        .fill(
          Path(
            CGRect(
              x: x - stemWidth / 2, y: min(outer, end), width: stemWidth, height: abs(end - outer)))
        ),
        element: item.id)
    }

    addBeam(
      from: firstX - stemWidth / 2, to: lastX + stemWidth / 2, level: 0, inward: inward,
      thickness: thickness, beamY: beamY)

    // Second and third beams between neighbors that both have them, or a stub on a lone one.
    for level in 1...2 {
      for (index, item) in group.enumerated()
      where Self.flagCount(Self.noteType(item.element.written).base) > level {
        let x = stemX(item, up: up)
        let next = index + 1 < group.count ? group[index + 1] : nil
        let previous = index > 0 ? group[index - 1] : nil
        let nextHas =
          next.map { Self.flagCount(Self.noteType($0.element.written).base) > level } ?? false
        let previousHas =
          previous.map { Self.flagCount(Self.noteType($0.element.written).base) > level } ?? false

        if let next, nextHas {
          addBeam(
            from: x - stemWidth / 2, to: stemX(next, up: up) + stemWidth / 2, level: level,
            inward: inward, thickness: thickness, beamY: beamY)
        } else if !previousHas {
          let stub = space * 1.1
          let toward = next == nil ? -stub : stub
          addBeam(
            from: min(x, x + toward), to: max(x, x + toward), level: level, inward: inward,
            thickness: thickness, beamY: beamY)
        }
      }
    }
  }

  private mutating func addBeam(
    from startX: CGFloat, to endX: CGFloat, level: Int, inward: CGFloat, thickness: CGFloat,
    beamY: (CGFloat) -> CGFloat
  ) {
    let offset = inward * CGFloat(level) * space * 0.75
    var path = Path()
    path.move(to: CGPoint(x: startX, y: beamY(startX) + offset))
    path.addLine(to: CGPoint(x: endX, y: beamY(endX) + offset))
    path.addLine(to: CGPoint(x: endX, y: beamY(endX) + offset + inward * thickness))
    path.addLine(to: CGPoint(x: startX, y: beamY(startX) + offset + inward * thickness))
    path.closeSubpath()
    add(.fill(path))
  }

  private mutating func drawTie(from start: Placed, pitch: ABCTune.Pitch, toX: CGFloat) {
    let up = stemsUp([start.element])
    let noteY = y(position(of: pitch.step))
    let direction: CGFloat = up ? 1 : -1
    let fromX = start.x + start.headWidth + space * 0.2
    let baseY = noteY + direction * space * 0.6
    var path = Path()
    path.move(to: CGPoint(x: fromX, y: baseY))
    path.addQuadCurve(
      to: CGPoint(x: toX, y: baseY),
      control: CGPoint(x: (fromX + toX) / 2, y: baseY + direction * space * 0.9))
    add(.stroke(path, width: max(space * 0.14, 1)), element: start.id)
  }

  // MARK: - Tab

  /// Each note's fret on the highest string that reaches it, as abcjs's guitar tab picks them;
  /// a chord's notes take one string each, the highest note first. A note a tie holds isn't
  /// played again. The guitar reads an octave above how it sounds, so the strings are E3 A3 D4
  /// G4 B4 E5 here.
  private mutating func drawTab(_ item: Placed) {
    guard let tabSpace else {
      return
    }

    let strings = [52, 57, 62, 67, 71, 76]
    var used = Set<Int>()

    for pitch in item.element.pitches.sorted(by: { $0.midi > $1.midi }) where !pitch.continuesTie {
      let string = strings.indices.last { strings[$0] <= pitch.midi && !used.contains($0) }

      if let string {
        used.insert(string)
      }

      let fret = string.map { String(pitch.midi - strings[$0]) } ?? "?"
      let row = string.map { strings.count - 1 - $0 } ?? strings.count - 1
      let point = CGPoint(x: item.x + item.headWidth / 2, y: tabTop + CGFloat(row) * tabSpace)
      add(.text(fret, at: point, kind: .tabFret), element: item.id)
    }
  }

  // MARK: - Items

  private mutating func add(_ mark: NotationDrawing.Mark, element: NotationElementID? = nil) {
    items.append(NotationDrawing.Item(mark: mark, element: element))
  }

  /// Where a mark reaches, texts by how they're anchored when drawn.
  private func bounds(of mark: NotationDrawing.Mark) -> CGRect {
    switch mark {
    case .fill(let path), .stroke(let path, _):
      return path.boundingRect
    case .text(_, let point, let kind):
      let top =
        switch kind {
        case .chordSymbol: point.y - textHeight
        case .tabFret, .tupletNumber: point.y - textHeight / 2
        case .endingNumber: point.y
        }

      return CGRect(x: point.x, y: top, width: 1, height: textHeight)
    }
  }

  private static func moved(
    _ item: NotationDrawing.Item, by transform: CGAffineTransform, dy: CGFloat
  )
    -> NotationDrawing.Item
  {
    var moved = item

    switch item.mark {
    case .fill(let path):
      moved = NotationDrawing.Item(mark: .fill(path.applying(transform)), element: item.element)
    case .stroke(let path, let width):
      moved = NotationDrawing.Item(
        mark: .stroke(path.applying(transform), width: width), element: item.element)
    case .text(let text, let point, let kind):
      moved = NotationDrawing.Item(
        mark: .text(text, at: CGPoint(x: point.x, y: point.y + dy), kind: kind),
        element: item.element)
    }

    return moved
  }
}
