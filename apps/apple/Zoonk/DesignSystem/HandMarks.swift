import SwiftUI

/// New terms are the text's bold runs, which stay bold so color is never the only cue.
struct RichTextMarks: Equatable {
  /// A quote of the text, in its markup, underlined where it first shows.
  var underline: String?
  var highlightsTerms = false
}

/// In UTF-16 offsets of the text as drawn, which is how `Text.Layout` numbers the characters its
/// glyphs come from.
struct InlineMarks: Equatable {
  /// The underlined phrase's words, so a line that breaks after one ends the line's stroke at the
  /// word, not at the space after it.
  var underline: [Range<Int>] = []
  var terms: [Range<Int>] = []

  var isEmpty: Bool { underline.isEmpty && terms.isEmpty }

  init(underline: [Range<Int>] = [], terms: [Range<Int>] = []) {
    self.underline = underline
    self.terms = terms
  }

  /// `underline` is the phrase as drawn, without its markup.
  init(_ text: AttributedString, underline: String?, highlightsTerms: Bool) {
    self.underline =
      underline.flatMap { phrase in
        text.range(of: phrase).map { Self.words(in: Self.offsets(of: $0, in: text), of: text) }
      } ?? []

    guard highlightsTerms else {
      return
    }

    terms = text.runs.compactMap { run in
      run.inlinePresentationIntent?.contains(.stronglyEmphasized) == true
        ? Self.offsets(of: run.range, in: text) : nil
    }
  }

  private static func offsets(of range: Range<AttributedString.Index>, in text: AttributedString)
    -> Range<Int>
  {
    let start = String(text.characters[text.startIndex..<range.lowerBound]).utf16.count
    return start..<(start + String(text.characters[range]).utf16.count)
  }

  private static func words(in range: Range<Int>, of text: AttributedString) -> [Range<Int>] {
    let units = Array(String(text.characters).utf16)
    var words: [Range<Int>] = []
    var start: Int?

    for offset in range {
      let isSpace = Unicode.Scalar(units[offset])?.properties.isWhitespace == true

      if isSpace, let wordStart = start {
        words.append(wordStart..<offset)
        start = nil
      } else if !isSpace, start == nil {
        start = offset
      }
    }

    if let start {
      words.append(start..<range.upperBound)
    }

    return words
  }
}

extension View {
  @ViewBuilder
  func handMarks(_ marks: InlineMarks) -> some View {
    if marks.isEmpty {
      self
    } else {
      textRenderer(HandMarksRenderer(marks: marks))
    }
  }
}

/// Drawn line by line so the marks wrap with the text, and sized from each line's metrics so they
/// follow Dynamic Type.
struct HandMarksRenderer: TextRenderer {
  let marks: InlineMarks

  var displayPadding: EdgeInsets {
    EdgeInsets(top: 0, leading: 4, bottom: 10, trailing: 4)
  }

  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    let isStrong = context.environment.colorSchemeContrast == .increased
    let lines = layout.map { line in line.flatMap { $0 } }
    // The layout numbers characters from a base it doesn't expose: the text's first glyph's.
    guard let start = lines.joined().flatMap(\.characterIndices).min() else {
      return
    }

    let underlined = lines.map { glyphs in
      Self.span(of: marks.underline, in: glyphs, from: start)
    }
    let underline = zip(layout, underlined).first { $0.1 != nil }.map { line, _ in
      HandUnderline(
        widths: underlined.compactMap { $0.map { $0.upperBound - $0.lowerBound } },
        unit: line.typographicBounds.descent / 9)
    }
    var slices = underline?.slices.makeIterator()

    for ((line, glyphs), span) in zip(zip(layout, lines), underlined) {
      let bounds = line.typographicBounds

      for term in marks.terms {
        if let span = Self.span(of: [term], in: glyphs, from: start) {
          let rect = CGRect(
            x: span.lowerBound - 3, y: bounds.origin.y - bounds.ascent * 0.86,
            width: span.upperBound - span.lowerBound + 6,
            height: bounds.ascent * 0.86 + bounds.descent)
          context.fill(
            Path(roundedRect: rect, cornerRadius: min(5, rect.height / 4), style: .continuous),
            with: .color(.warning.opacity(isStrong ? 0.4 : 0.22)))
        }
      }

      if let span, let slice = slices?.next(), let underline {
        Self.stroke(
          slice, of: underline,
          at: CGPoint(x: span.lowerBound, y: bounds.origin.y), isStrong: isStrong, in: &context)
      }

      context.draw(line)
    }
  }

  private static func span(
    of ranges: [Range<Int>], in glyphs: [Text.Layout.RunSlice],
    from start: Text.Layout.CharacterIndex
  ) -> ClosedRange<CGFloat>? {
    let marked = glyphs.filter { glyph in
      glyph.characterIndices.contains { index in
        ranges.contains { $0.contains(start.distance(to: index)) }
      }
    }
    let edges = marked.map { $0.typographicBounds.rect }

    guard let minX = edges.map(\.minX).min(), let maxX = edges.map(\.maxX).max() else {
      return nil
    }

    return minX...maxX
  }

  private static func stroke(
    _ slice: HandUnderline.Slice, of underline: HandUnderline, at origin: CGPoint, isStrong: Bool,
    in context: inout GraphicsContext
  ) {
    let place = { (points: [CGPoint]) in
      var path = Path()
      path.addLines(points.map { CGPoint(x: origin.x + $0.x, y: origin.y + $0.y) })
      return path
    }

    context.stroke(
      place(slice.pen), with: .color(.warning),
      style: StrokeStyle(lineWidth: underline.weight, lineCap: .round, lineJoin: .round))
    context.stroke(
      place(slice.pass), with: .color(.warning.opacity(isStrong ? 1 : 0.65)),
      style: StrokeStyle(lineWidth: underline.weight / 2, lineCap: .round, lineJoin: .round))
  }
}

/// Lousa's hand-drawn underline: a pen stroke and a lighter second pass along the whole phrase. Its
/// wave keeps one length for the text's size, so a phrase that wraps gives each line its slice of the
/// same stroke instead of the whole squiggle squeezed into each, and only the phrase's real end lifts
/// into the closing flick, never a line break.
struct HandUnderline: Equatable {
  /// In points: across from where the phrase starts on its line, down from the line's baseline.
  struct Slice: Equatable {
    let pen: [CGPoint]
    let pass: [CGPoint]
  }

  let slices: [Slice]
  let weight: CGFloat

  /// `widths` are the phrase's widths on its lines, in order; `unit` is a ninth of the text's descent.
  init(widths: [CGFloat], unit: CGFloat) {
    let length = widths.reduce(0, +) / unit
    let inset = min(8, length * 0.06)
    let starts = widths.indices.map { widths[..<$0].reduce(0, +) / unit }

    slices = zip(starts, widths).map { start, width in
      let end = start + width / unit
      let trace = { (from: CGFloat, to: CGFloat, height: (CGFloat) -> CGFloat) -> [CGPoint] in
        guard to > from else {
          return []
        }

        let count = max(Int(((to - from) / 4).rounded(.up)), 1)

        return (0...count).map { step in
          let distance = from + (to - from) * CGFloat(step) / CGFloat(count)
          return CGPoint(x: (distance - start) * unit, y: height(distance) * unit)
        }
      }

      return Slice(
        pen: trace(start, end) { Self.pen(at: $0, along: length) },
        pass: trace(max(start, inset), min(end, length - inset), Self.pass(at:)))
    }
    weight = max(1.5, unit * 4.5)
  }

  /// How far below the baseline the pen is, in units, `distance` units along a phrase `length` long.
  /// Its wave depends only on the distance; the phrase's length only places the closing flick.
  static func pen(at distance: CGFloat, along length: CGFloat) -> CGFloat {
    let flick = min(28, length * 0.35)
    let lift = max(0, distance - (length - flick)) / max(flick, 1)

    return 8.8 + 1.4 * sin(2 * .pi * distance / 160 + 0.6)
      + 0.6 * sin(2 * .pi * distance / 91 + 2.1) - 3.5 * lift * lift
  }

  private static func pass(at distance: CGFloat) -> CGFloat {
    11.4 + 0.7 * sin(2 * .pi * distance / 210 + 1.7)
  }
}
