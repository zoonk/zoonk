import Foundation

extension LessonRichText {
  /// What it draws, without its styling.
  static func plain(_ text: String) -> String {
    String(typeset(text).text.characters)
  }

  /// What VoiceOver says for it, for a label or an announcement: "Matched 1 over 2 with 0.5.".
  static func spoken(_ text: String) -> String {
    typeset(text).said
  }
}
