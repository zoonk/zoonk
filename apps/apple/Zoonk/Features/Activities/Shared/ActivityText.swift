import Foundation

extension LessonRichText {
  static func plain(_ text: String) -> String {
    String(attributed(text).characters)
  }
}
