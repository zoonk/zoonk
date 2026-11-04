import Foundation

/// `@zoonk/auth/name-rules`: a name saved before the limit stays until the learner changes it.
enum ProfileName {
  static let maxLength = 150

  static func isChange(_ name: String, saved: String) -> Bool {
    trimmed(name) != trimmed(saved)
  }

  /// Counts code points, as the server's length check does.
  static func isChangeTooLong(_ name: String, saved: String) -> Bool {
    isChange(name, saved: saved) && trimmed(name).unicodeScalars.count > maxLength
  }

  private static func trimmed(_ name: String) -> String {
    name.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
