import Observation

/// Kept above a pane split: folding iPhone Duo or resizing an iPad recreates the panes, and the
/// start under way, its refusal and its failure stay with the screen.
@MainActor
@Observable
final class CallStart {
  private(set) var isStarting = false
  private(set) var isWriting = false
  private(set) var refusal: CallReservation?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// Only from the learner's tap. `onStarted` gets the new call's id.
  func start(
    _ input: Components.Schemas.LanguageConversationStartInput, voice: VoiceServices,
    onStarted: @escaping (String) -> Void
  ) {
    guard !isStarting else {
      return
    }

    isStarting = true
    refusal = nil

    task = Task {
      let result = await voice.startConversation(input) { [weak self] in
        self?.isWriting = true
      }
      isStarting = false
      isWriting = false

      switch result {
      case .done(.done(let id)):
        onStarted(id)
      case .done(.refused(let refusal)):
        self.refusal = CallReservation(refusal: refusal)
      case .failed:
        refusal = .failed
      case .obsolete:
        break
      }
    }
  }

  /// Its screen left: a start answered later opens nothing.
  func cancel() {
    task?.cancel()
  }
}
