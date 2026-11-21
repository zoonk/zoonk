import SwiftUI

/// A line of rich text with its inline code as main draws it: Geist Mono at 0.85 of the text around
/// it, in the ink color, on a muted chip that each line's piece of it keeps.
struct RichInlineText: View {
  let inline: RichInline
  var underline: String?
  var highlightsTerms = false

  @Environment(\.typeStyle) private var style
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  init(_ inline: RichInline, underline: String? = nil, highlightsTerms: Bool = false) {
    self.inline = inline
    self.underline = underline
    self.highlightsTerms = highlightsTerms
  }

  var body: some View {
    let inline = InlineCode.opened(self.inline)
    let hasCode = inline.text.runs.contains { InlineCode.isCode($0.inlinePresentationIntent) }

    let text = Text(
      InlineCode.drawn(inline, in: style, legibility: legibilityWeight),
      legibility: legibilityWeight
    )
    .handMarks(InlineMarks(inline.text, underline: underline, highlightsTerms: highlightsTerms))

    // Spacing added to each line's own height leaves a row of code shorter than a row of words, as
    // Geist Mono's smaller size is; main's rows keep the role's height, whatever runs they hold.
    if hasCode, style.lineHeight != nil {
      text
        .lineSpacing(0)
        .lineHeight(.exact(points: style.rowHeight(dynamicTypeSize)))
    } else {
      text
    }
  }
}

enum InlineCode {
  /// Main's chip padding: the space kept on each side of a run, which its chip fills.
  static let padding: CGFloat = 4

  static func isCode(_ intent: InlinePresentationIntent?) -> Bool {
    intent?.contains(.code) == true
  }

  /// A run that opens the text has no character before it to keep its padding, so a no-break space
  /// a point wide keeps it: a character that draws nothing, such as a word joiner, leaves the
  /// layout, and its padding with it.
  static func opened(_ inline: RichInline) -> RichInline {
    guard let first = inline.text.runs.first, isCode(first.inlinePresentationIntent) else {
      return inline
    }

    var space = AttributedString("\u{00A0}")
    space.font = .system(size: 1)

    var opened = inline
    opened.text = space + inline.text
    return opened
  }

  /// Sets each code run in `style`'s inline code font and keeps the characters around it a chip's
  /// padding away. Only attributes change, so marks counted on `inline` still fit.
  static func drawn(_ inline: RichInline, in style: TypeStyle, legibility: LegibilityWeight?)
    -> RichInline
  {
    let runs = Array(inline.text.runs)

    guard runs.contains(where: { isCode($0.inlinePresentationIntent) }) else {
      return inline
    }

    let font = style.inlineCodeFont(legibility: legibility)
    var text = AttributedString()

    for (index, run) in runs.enumerated() {
      var piece = AttributedString(inline.text[run.range])
      let isCode = Self.isCode(run.inlinePresentationIntent)

      if isCode {
        piece.font = font
        piece.foregroundColor = Color(.foreground)
        piece.inlinePresentationIntent = run.inlinePresentationIntent?.subtracting(.code)
      }

      let padsEnd =
        isCode || (index + 1 < runs.count && Self.isCode(runs[index + 1].inlinePresentationIntent))

      // Tracking, not kern: the tracking every type role sets turns a run's kern off.
      if padsEnd, let last = piece.characters.indices.last {
        piece[last...].tracking = padding
      }

      text += piece
    }

    var drawn = inline
    drawn.text = text
    return drawn
  }
}

extension CodeBreaks {
  /// Inline code's break points, in each of its runs' long words.
  static func inserted(into text: AttributedString) -> AttributedString {
    text.runs.reduce(into: AttributedString()) { result, run in
      result +=
        InlineCode.isCode(run.inlinePresentationIntent)
        ? AttributedString(
          insertedInLongWords(into: String(text[run.range].characters)),
          attributes: run.attributes)
        : AttributedString(text[run.range])
    }
  }
}
