import Foundation

extension LessonRichText {
  /// The text without its markup, for VoiceOver labels and announcements.
  static func plain(_ text: String) -> String {
    String(attributed(text).characters)
  }
}
