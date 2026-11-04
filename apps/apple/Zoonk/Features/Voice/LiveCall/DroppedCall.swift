/// What the dropped screen shows: why the call can't go on (nil keeps the plain "call dropped"
/// line) and how the learner can call again, if that can work. Ending the call is always there.
struct DroppedCall: Equatable {
  enum Reason: Equatable {
    case callInProgress, callsPaused, ended, limit, microphone, plusRequired
  }

  enum Retry: Equatable {
    case callAgain, microphone, takeover
  }

  let reason: Reason?
  let retry: Retry?
}

extension DroppedCall {
  /// Nil when the screen isn't a dropped call. A call that dropped stays dropped until its reconnect
  /// calls and whatever stops it (`continuing`), so it can still be ended and saved. The microphone
  /// counts only while the reconnect waits on it: typing instead keeps it blocked.
  init?(continuing: Bool, phase: LiveCall.Phase, failure: LiveCall.Failure?, micBlocked: Bool) {
    if continuing, phase == .idle {
      if micBlocked {
        self.init(reason: .microphone, retry: .microphone)
      } else {
        self.init(reason: nil, retry: .callAgain)
      }

      return
    }

    guard phase == .failed, let failure, continuing || failure == .dropped else {
      return nil
    }

    switch failure {
    case .connect, .dropped: self.init(reason: nil, retry: .callAgain)
    case .callsPaused: self.init(reason: .callsPaused, retry: .callAgain)
    case .callInProgress: self.init(reason: .callInProgress, retry: .takeover)
    case .ended: self.init(reason: .ended, retry: nil)
    case .limit: self.init(reason: .limit, retry: nil)
    case .plusRequired: self.init(reason: .plusRequired, retry: nil)
    }
  }
}
