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
  var underline: Range<Int>?
  var terms: [Range<Int>] = []

  var isEmpty: Bool { underline == nil && terms.isEmpty }

  init(underline: Range<Int>? = nil, terms: [Range<Int>] = []) {
    self.underline = underline
    self.terms = terms
  }

  /// `underline` is the phrase as drawn, without its markup.
  init(_ text: AttributedString, underline: String?, highlightsTerms: Bool) {
    self.underline = underline.flatMap { phrase in
      text.range(of: phrase).map { Self.offsets(of: $0, in: text) }
    }

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

    for (index, (line, glyphs)) in zip(layout, lines).enumerated() {
      let bounds = line.typographicBounds

      for term in marks.terms {
        if let span = Self.span(of: term, in: glyphs, from: start) {
          let rect = CGRect(
            x: span.lowerBound - 3, y: bounds.origin.y - bounds.ascent * 0.86,
            width: span.upperBound - span.lowerBound + 6,
            height: bounds.ascent * 0.86 + bounds.descent)
          context.fill(
            Path(roundedRect: rect, cornerRadius: min(5, rect.height / 4), style: .continuous),
            with: .color(.warning.opacity(isStrong ? 0.4 : 0.22)))
        }
      }

      if let underline = marks.underline,
        let span = Self.span(of: underline, in: glyphs, from: start)
      {
        Self.stroke(under: span, of: bounds, line: index, isStrong: isStrong, in: &context)
      }

      context.draw(line)
    }
  }

  private static func span(
    of range: Range<Int>, in glyphs: [Text.Layout.RunSlice], from start: Text.Layout.CharacterIndex
  ) -> ClosedRange<CGFloat>? {
    let marked = glyphs.filter { glyph in
      glyph.characterIndices.contains { range.contains(start.distance(to: $0)) }
    }
    let edges = marked.map { $0.typographicBounds.rect }

    guard let minX = edges.map(\.minX).min(), let maxX = edges.map(\.maxX).max() else {
      return nil
    }

    return minX...maxX
  }

  /// The concept's pen stroke, a 200 by 12 drawing stretched to the phrase; alternate lines waver
  /// differently, as a hand would.
  private static func stroke(
    under span: ClosedRange<CGFloat>, of bounds: Text.Layout.TypographicBounds, line: Int,
    isStrong: Bool, in context: inout GraphicsContext
  ) {
    let unit = bounds.descent / 9
    let width = span.upperBound - span.lowerBound
    let lift: CGFloat = line.isMultiple(of: 2) ? 0 : 0.8
    let point = { (x: CGFloat, y: CGFloat) in
      CGPoint(
        x: span.lowerBound + x / 200 * width,
        y: bounds.origin.y + bounds.descent * 0.2 + (y + lift) * unit)
    }

    var pen = Path()
    pen.move(to: point(2, 7.5))
    pen.addCurve(to: point(98, 6.5), control1: point(30, 4.5), control2: point(62, 9))
    pen.addCurve(to: point(198, 7), control1: point(134, 4), control2: point(168, 4.5))

    var pass = Path()
    pass.move(to: point(8, 10))
    pass.addCurve(to: point(192, 9), control1: point(52, 8), control2: point(122, 10.5))

    let weight = max(1.5, bounds.descent * 0.5)
    context.stroke(
      pen, with: .color(.warning),
      style: StrokeStyle(lineWidth: weight, lineCap: .round, lineJoin: .round))
    context.stroke(
      pass, with: .color(.warning.opacity(isStrong ? 1 : 0.65)),
      style: StrokeStyle(lineWidth: weight / 2, lineCap: .round))
  }
}
