import Foundation

/// How long the learner waited for the character, for the call-ended event, as main counts it: from
/// their microphone going quiet to the character's next transcript arriving, a proxy for the wait
/// they heard. A pause shorter than a slow reply is the learner thinking, so it stays one turn.
struct LiveCallReplyGaps: Equatable {
  /// A gap longer than this is a slow reply.
  static let slow: TimeInterval = 3

  private(set) var gaps: [TimeInterval] = []
  /// Learner turns the character left unanswered for longer than a slow reply.
  private(set) var unansweredTurns = 0
  /// An app cue went out in this turn: the character's next words answer it, not only the learner.
  private var cued = false
  private var voicedAt: Date?
  private var stoppedAt: Date?

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
    settle(at: now)

    if voicedAt == nil {
      unansweredTurns += isUnanswered(at: now) ? 1 : 0
      // Speaking again after a pause is the same turn, which keeps a cue sent during it.
      cued = stoppedAt != nil && cued
      stoppedAt = nil
    }

    voicedAt = now
  }

  /// A typed reply included.
  mutating func cueSent() {
    cued = true
  }

  mutating func characterSpoke(at now: Date) {
    settle(at: now)

    if let stoppedAt, !cued {
      gaps.append(now.timeIntervalSince(stoppedAt))
    }

    cued = false
    stoppedAt = nil
  }

  mutating func callEnded(at now: Date) {
    settle(at: now)
    unansweredTurns += isUnanswered(at: now) ? 1 : 0
  }

  /// The microphone went quiet at its last voiced sample once the hangover passed.
  private mutating func settle(at now: Date) {
    if let voicedAt, now.timeIntervalSince(voicedAt) >= LiveCallEnding.micHangover {
      stoppedAt = voicedAt
      self.voicedAt = nil
    }
  }

  private func isUnanswered(at now: Date) -> Bool {
    stoppedAt.map { now.timeIntervalSince($0) > Self.slow } ?? false
  }

  private func milliseconds(_ seconds: TimeInterval) -> Int {
    Int((seconds * 1000).rounded())
  }
}
