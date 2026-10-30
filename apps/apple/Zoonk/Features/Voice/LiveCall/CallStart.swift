import Observation

/// Kept above a pane split: folding iPhone Duo or resizing an iPad recreates the panes, and the
/// start under way, its refusal and its failure stay with the screen.
@MainActor
@Observable
final class CallStart {
  private(set) var isStarting = false
  private(set) var refusal: CallReservation?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// Only from the learner's tap: it writes the call's card.
  func start(
    _ input: Components.Schemas.LanguageConversationStartInput, voice: VoiceServices,
    router: AppRouter
  ) {
    guard !isStarting else {
      return
    }

    isStarting = true
    refusal = nil

    task = Task {
      let result = await voice.startConversation(input)
      isStarting = false

      switch result {
      case .done(.done(let id)):
        router.open(.conversation(conversationId: id))
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
