import Foundation

enum WordCount {
  /// Core's `countWords`: text without spaces (Japanese, Chinese, Thai) counts the words a
  /// dictionary finds.
  static func count(_ text: String) -> Int {
    text.split(whereSeparator: \.isWhitespace).reduce(0) { total, piece in
      let piece = String(piece)

      guard
        piece.contains(
          /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/
        )
      else {
        return total + (piece.contains(/[\p{L}\p{N}]/) ? 1 : 0)
      }

      var words = 0
      piece.enumerateSubstrings(in: piece.startIndex..., options: .byWords) { _, _, _, _ in
        words += 1
      }

      return total + words
    }
  }
}
