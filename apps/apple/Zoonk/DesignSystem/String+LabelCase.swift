import Foundation

extension String {
  /// Main's `toLabelCase`: words written mid-sentence ("quinta-feira") capitalized to stand alone.
  func labelCased(_ locale: Locale = .autoupdatingCurrent) -> String {
    prefix(1).uppercased(with: locale) + dropFirst()
  }
}
