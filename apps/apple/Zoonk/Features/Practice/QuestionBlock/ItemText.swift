import SwiftUI

struct ItemText: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    RichTextBlocks(text, inline: ItemTextBlock.inline)
  }
}

enum ItemTextBlock {
  static func inline(_ text: String) -> AttributedString {
    RichTextTypography.typesetNumbers(in: markdown(text))
  }

  static func plain(_ text: String) -> String {
    String(inline(text).characters)
  }

  /// A learner's earlier answer, quoted without its markup but with their numbers as they wrote them.
  static func asWritten(_ text: String) -> String {
    String(markdown(text).characters)
  }

  /// Text that isn't valid Markdown stays as written.
  private static func markdown(_ text: String) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace,
      failurePolicy: .returnPartiallyParsedIfPossible)
    return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
  }
}
