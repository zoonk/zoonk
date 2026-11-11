import Observation

/// What one window's session shows: the question block playing, the moment the last one ended with,
/// or the summary after "Stop for today". Each window's router keeps its own, so another window's
/// block never replaces the answer in progress here.
@MainActor
@Observable
final class SessionPlayback {
  private(set) var playingBlockID: String?
  /// A block a tap on another screen opened, waiting on the next stop for the learner's Start.
  private(set) var heldBlockID: String?
  private(set) var moment: BlockMoment?
  private(set) var stoppedSessionID: String?

  func play(blockID: String) {
    playingBlockID = blockID
    heldBlockID = nil
    moment = nil
    stoppedSessionID = nil
  }

  func hold(blockID: String) {
    playingBlockID = nil
    heldBlockID = blockID
    moment = nil
    stoppedSessionID = nil
  }

  func finish(_ completion: BlockMoment?) {
    playingBlockID = nil
    moment = completion
  }

  func stop(sessionID: String) {
    playingBlockID = nil
    heldBlockID = nil
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
    heldBlockID = nil
    moment = nil
    stoppedSessionID = nil
  }
}
