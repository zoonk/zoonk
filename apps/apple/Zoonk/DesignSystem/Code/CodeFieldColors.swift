import SwiftUI

extension CodeHighlight {
  /// `code` in main's colors exactly as written, with no room for indentation or break points
  /// added, so it lays out as a field holding the same text does.
  static func colored(_ code: String, language: String?) -> AttributedString {
    var text = AttributedString()

    for (index, line) in lines(of: code, language: language).enumerated() {
      if index > 0 {
        text += AttributedString("\n")
      }

      for token in line {
        text += styled(token.text, token.kind)
      }
    }

    return text
  }
}

extension View {
  /// Main's code fields keep the program's colors as the learner types: like main's textarea over
  /// its tokens, the field's own text is clear over the same text in color. Both take one font and
  /// wrap at one width, so each glyph lies on its colored twin.
  func codeColors(_ code: String, language: String?) -> some View {
    foregroundStyle(.clear)
      .tint(Color(.foreground))
      .background(alignment: .topLeading) {
        Text(CodeHighlight.colored(code, language: language))
          .foregroundStyle(Color(.foreground))
          .frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityHidden(true)
      }
  }
}
