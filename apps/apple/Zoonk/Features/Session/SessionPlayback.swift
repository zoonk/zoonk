import Observation

/// What one window's session shows: the question block playing, the moment the last one ended with,
/// or the summary after "Stop for today". Each window's router keeps its own, so another window's
/// block never replaces the answer in progress here.
@MainActor
@Observable
final class SessionPlayback {
  private(set) var playingBlockID: String?
  /// The step a tap on another screen opened the session on, which waits there for the learner's
  /// Start; nil for the day's next step.
  private(set) var shownBlockID: String?
  private(set) var moment: BlockMoment?
  private(set) var stoppedSessionID: String?

  func play(blockID: String) {
    playingBlockID = blockID
    shownBlockID = nil
    moment = nil
    stoppedSessionID = nil
  }

  func show(blockID: String?) {
    playingBlockID = nil
    shownBlockID = blockID
    moment = nil
    stoppedSessionID = nil
  }

  func finish(_ completion: BlockMoment?) {
    playingBlockID = nil
    moment = completion
  }

  /// "See today's summary" from the moment that completed the session.
  func seeSummary() {
    moment = nil
  }

  func stop(sessionID: String) {
    playingBlockID = nil
    shownBlockID = nil
    stoppedSessionID = sessionID
  }

  /// "Keep going" after "Stop for today": the next stop shows again.
  func resume(sessionID: String) {
    if stoppedSessionID == sessionID {
      stoppedSessionID = nil
    }
  }

  func leave() {
    playingBlockID = nil
    shownBlockID = nil
    moment = nil
    stoppedSessionID = nil
  }
}
