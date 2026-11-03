import Foundation

/// When the call's goals are checked, as main decides it: once the transcript has been still for a
/// while, if it holds learner words no check read and the character answered them. The learner's
/// words come back 1.3 to 1.8 s late, often after that answer, so who spoke last is read from the
/// session's timeline (`startMs`), not from when the words arrived.
struct ObjectiveCheckTiming {
  /// Longer than the learner's transcript lags, so one exchange takes one check.
  static let settle = Duration.milliseconds(2000)

  private var latestSpeaker: ConversationSpeaker?
  private var latestStartMs = 0.0
  private var hasUnreadLearnerWords = false

  var isDue: Bool {
    hasUnreadLearnerWords && latestSpeaker == .character
  }

  /// A typed reply has no `startMs`: it counts as the latest words when it's sent.
  mutating func hear(_ speaker: ConversationSpeaker, startMs: Double?) {
    let start = startMs ?? latestStartMs

    if latestSpeaker == nil || start >= latestStartMs {
      latestSpeaker = speaker
      latestStartMs = start
    }

    if speaker == .learner {
      hasUnreadLearnerWords = true
    }
  }

  /// A check took the transcript as it is now.
  mutating func read() {
    hasUnreadLearnerWords = false
  }
}
