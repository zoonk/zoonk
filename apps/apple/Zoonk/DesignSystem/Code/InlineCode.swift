import SwiftUI

/// A line of rich text with its inline code as main draws it: Geist Mono at 0.85 of the text around
/// it, in the ink color, on a muted chip that each line's piece of it keeps.
struct RichInlineText: View {
  let inline: RichInline
  var underline: String?
  var highlightsTerms = false

  @Environment(\.typeStyle) private var style
  @Environment(\.legibilityWeight) private var legibilityWeight

  init(_ inline: RichInline, underline: String? = nil, highlightsTerms: Bool = false) {
    self.inline = inline
    self.underline = underline
    self.highlightsTerms = highlightsTerms
  }

  var body: some View {
    Text(
      InlineCode.drawn(inline, in: style, legibility: legibilityWeight),
      legibility: legibilityWeight
    )
    .handMarks(InlineMarks(inline.text, underline: underline, highlightsTerms: highlightsTerms))
  }
}

enum InlineCode {
  /// Main's chip padding: the space kept on each side of a run, which its chip fills.
  static let padding: CGFloat = 4

  static func isCode(_ intent: InlinePresentationIntent?) -> Bool {
    intent?.contains(.code) == true
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

      if padsEnd, let last = piece.characters.indices.last {
        piece[last...].kern = padding
      }

      text += piece
    }

    var drawn = inline
    drawn.text = text
    return drawn
  }
}

extension CodeBreaks {
  /// Inline code's break points, in each of its runs.
  static func inserted(into text: AttributedString) -> AttributedString {
    text.runs.reduce(into: AttributedString()) { result, run in
      result +=
        InlineCode.isCode(run.inlinePresentationIntent)
        ? AttributedString(
          inserted(into: String(text[run.range].characters)), attributes: run.attributes)
        : AttributedString(text[run.range])
    }
  }
}
