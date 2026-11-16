import Observation

/// Kept above a pane split: folding iPhone Duo or resizing an iPad recreates the panes, and the
/// start under way, its refusal and its failure stay with the screen. They're the visit's: `leave()`
/// as the screen goes away.
@MainActor
@Observable
final class CallStart {
  private enum Ended {
    case started(String)
    case refused(CallReservation)
  }

  private let request = VisitRequest<Ended>()
  private var writing = false

  var isStarting: Bool { request.isRunning }
  var isWriting: Bool { request.isRunning && writing }

  var refusal: CallReservation? {
    if case .refused(let refusal) = request.outcome { refusal } else { nil }
  }

  /// Only from the learner's tap. `onStarted` gets the new call's id.
  func start(
    _ input: Components.Schemas.LanguageConversationStartInput, voice: VoiceServices,
    onStarted: @escaping (String) -> Void
  ) {
    guard !request.isRunning else {
      return
    }

    writing = false

    request.run {
      switch await voice.startConversation(input, whileWriting: { self.writing = true }) {
      case .done(.done(let id)): return Ended.started(id)
      case .done(.refused(let refusal)): return Ended.refused(CallReservation(refusal: refusal))
      case .failed: return Ended.refused(.failed)
      case .obsolete: return nil
      }
    } then: { ended in
      if case .started(let id) = ended {
        onStarted(id)
      }
    }
  }

  /// Its screen left: a start answered later opens nothing, and a refusal shown is gone.
  func leave() {
    request.leave()
  }
}
