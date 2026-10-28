import SwiftUI

/// Item text (a question, its context, an option, an explanation): paragraphs, short lists and
/// tables of data, with inline code, bold and italics, as item writers are told.
struct ItemText: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    RichTextBlocks(text, inline: ItemTextBlock.inline)
  }
}

/// How item text reads inline, wherever the app shows it.
enum ItemTextBlock {
  /// Inline Markdown (bold, italics, code); text that isn't valid Markdown stays as written.
  static func inline(_ text: String) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace,
      failurePolicy: .returnPartiallyParsedIfPossible)
    return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
  }

  /// The words of item text without its Markdown, for VoiceOver labels and one-line answers.
  static func plain(_ text: String) -> String {
    String(inline(text).characters)
  }
}
