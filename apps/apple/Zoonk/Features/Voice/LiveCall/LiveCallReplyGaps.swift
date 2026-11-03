import Foundation

/// How long the character took to answer, for the call-ended event. A gap runs from the learner's
/// microphone going quiet to the character's next transcript fragment arriving: a proxy for the
/// wait the learner hears, since the text leads the voice a little.
struct LiveCallReplyGaps: Equatable {
  /// A gap longer than this is a slow reply.
  static let slow: TimeInterval = 3

  private(set) var gaps: [TimeInterval] = []
  /// Learner turns no character transcript followed.
  private(set) var unansweredTurns = 0
  private var learnerQuietSince: Date?

  var medianMs: Int? {
    guard !gaps.isEmpty else {
      return nil
    }

    let sorted = gaps.sorted()
    let middle = sorted.count / 2
    let median =
      sorted.count.isMultiple(of: 2) ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
    return milliseconds(median)
  }

  var maxMs: Int? {
    gaps.max().map(milliseconds)
  }

  var slowReplies: Int {
    gaps.count { $0 > Self.slow }
  }

  mutating func learnerSpoke(at now: Date) {
    countUnanswered(at: now)
    learnerQuietSince = now
  }

  /// The character's next words answer the app's cue (a typed reply included), not the learner's
  /// voice.
  mutating func cueSent() {
    learnerQuietSince = nil
  }

  /// Words that arrive while the learner is still talking overlap them: no reply yet.
  mutating func characterSpoke(at now: Date) {
    guard let learnerQuietSince,
      now.timeIntervalSince(learnerQuietSince) >= LiveCallEnding.micHangover
    else {
      return
    }

    gaps.append(now.timeIntervalSince(learnerQuietSince))
    self.learnerQuietSince = nil
  }

  /// A turn still waiting for its answer when the call ends got none.
  mutating func callEnded() {
    if learnerQuietSince != nil {
      unansweredTurns += 1
    }

    learnerQuietSince = nil
  }

  /// Speaking again after a slow reply's wait with nothing from the character starts a new turn.
  private mutating func countUnanswered(at now: Date) {
    if let learnerQuietSince, now.timeIntervalSince(learnerQuietSince) > Self.slow {
      unansweredTurns += 1
    }
  }

  private func milliseconds(_ seconds: TimeInterval) -> Int {
    Int((seconds * 1000).rounded())
  }
}
