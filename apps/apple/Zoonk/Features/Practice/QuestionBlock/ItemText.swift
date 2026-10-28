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
  /// Text that isn't valid Markdown stays as written.
  static func inline(_ text: String) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace,
      failurePolicy: .returnPartiallyParsedIfPossible)
    return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
  }

  static func plain(_ text: String) -> String {
    String(inline(text).characters)
  }
}
