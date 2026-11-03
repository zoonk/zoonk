import Foundation

/// How long the learner waited for the character, for the call-ended event: from their microphone
/// last hearing them to the character's next transcript arriving, a proxy for the wait they heard.
/// The character's words after a cue the app sent during the turn answer the cue, not only the
/// learner, so they're left out. A turn the character never answered (the learner spoke again after
/// a slow reply's wait, or the call ended) counts as unanswered.
struct LiveCallReplyGaps: Equatable {
  /// A gap longer than this is a slow reply.
  static let slow: TimeInterval = 3
  /// Two of the microphone's samples: the character's words sooner than this overlap the learner.
  private static let overlap: TimeInterval = 0.4

  private(set) var gaps: [TimeInterval] = []
  private(set) var unansweredTurns = 0
  /// The latest the microphone heard of the turn still waiting for its answer.
  private var voicedAt: Date?
  private var cued = false

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

  /// A microphone sample above the speech threshold.
  mutating func learnerSpoke(at now: Date) {
    if let voicedAt, now.timeIntervalSince(voicedAt) > Self.slow {
      unansweredTurns += 1
    }

    voicedAt = now
  }

  /// Covers the turn until the character answers, even if the learner pauses and goes on. A typed
  /// reply included.
  mutating func cueSent() {
    if voicedAt != nil {
      cued = true
    }
  }

  mutating func characterSpoke(at now: Date) {
    guard let voicedAt, now.timeIntervalSince(voicedAt) >= Self.overlap else {
      return
    }

    if !cued {
      gaps.append(now.timeIntervalSince(voicedAt))
    }

    self.voicedAt = nil
    cued = false
  }

  /// A turn still waiting for its answer, cut off by the hang-up included.
  mutating func callEnded() {
    if voicedAt != nil {
      unansweredTurns += 1
    }

    voicedAt = nil
  }

  private func milliseconds(_ seconds: TimeInterval) -> Int {
    Int((seconds * 1000).rounded())
  }
}
