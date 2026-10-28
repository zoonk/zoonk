import Foundation

/// Kept for the rest of the learner's day on this device, across lessons, until they take it back.
struct LessonTodayChoices: Sendable {
  enum Choice: String, Sendable {
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

  static let standard = LessonTodayChoices(
    today: { Date.now.formatted(.iso8601.year().month().day()) },
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
