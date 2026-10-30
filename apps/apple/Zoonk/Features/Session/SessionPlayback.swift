import Observation

/// What one window's session shows: the question block playing, the moment the last one ended with,
/// or the summary after "Stop for today". Each window's router keeps its own, so another window's
/// block never replaces the answer in progress here.
@MainActor
@Observable
final class SessionPlayback {
  private(set) var playingBlockID: String?
  private(set) var moment: BlockMoment?
  private(set) var stoppedSessionID: String?

  func play(blockID: String) {
    playingBlockID = blockID
    moment = nil
    stoppedSessionID = nil
  }

  func finish(_ completion: BlockMoment?) {
    playingBlockID = nil
    moment = completion
  }

  func stop(sessionID: String) {
    playingBlockID = nil
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
    moment = nil
    stoppedSessionID = nil
  }
}
