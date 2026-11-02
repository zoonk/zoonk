import SwiftUI

enum EssayWords {
  static func text(_ words: Int) -> Text {
    Text("\(words) words", tableName: "Essay", comment: "An essay's word count")
  }

  /// VoiceOver reads the count with its box, as main's `aria-describedby` does.
  static func hint(_ words: Int) -> Text {
    words > 0 ? text(words) : Text(verbatim: "")
  }
}
