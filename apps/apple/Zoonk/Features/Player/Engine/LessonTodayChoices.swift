import Foundation

/// Kept for the rest of the learner's day on this device, across lessons, until they take it back.
struct LessonTodayChoices: Sendable {
  enum Choice: String, Sendable {
    case cantListen = "zoonk:cant-listen-on"
    case cantTalk = "zoonk:cant-talk-on"
    case cantWrite = "zoonk:cant-write-on"
  }

  let today: @Sendable () -> String
  let read: @Sendable (Choice) -> String?
  let write: @Sendable (Choice, String?) -> Void

  func isChosenToday(_ choice: Choice) -> Bool {
    read(choice) == today()
  }

  func setChosenToday(_ choice: Choice, _ chosen: Bool) {
    write(choice, chosen ? today() : nil)
  }

  /// The learner's own calendar day, as main keys it: ISO 8601 alone would read it in GMT.
  static func day(of date: Date, in timeZone: TimeZone = .current) -> String {
    date.formatted(Date.ISO8601FormatStyle(timeZone: timeZone).year().month().day())
  }

  static let standard = LessonTodayChoices(
    today: { day(of: .now) },
    read: { UserDefaults.standard.string(forKey: $0.rawValue) },
    write: { choice, value in UserDefaults.standard.set(value, forKey: choice.rawValue) })
}

extension LessonStep {
  var hasExampleLineSlot: Bool {
    if case .explanation(let content) = content {
      return content.exampleLineSlot != nil
    }

    return false
  }
}
