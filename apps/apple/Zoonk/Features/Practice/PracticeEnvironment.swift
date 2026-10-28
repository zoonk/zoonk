import SwiftUI

/// What changed after a practice answer or finish, for the app's shared data to read again
/// (`PracticeStore.changed`).
enum PracticeChange: Equatable, Sendable {
  /// An answer was saved: the mistakes count and the day's progress may have moved.
  case answered
  /// A block, run or test finished: the day, missions, level and Energy may have moved.
  case finished
  /// The plan changed (a test-out's skip or its undo, a focus test, a challenge's move).
  case planChanged
}

/// Where a practice screen goes next. The shell's router opens these; see PRACTICE-CONTRACT.md.
enum PracticeDestination: Equatable, Sendable {
  case checkpoint(blockId: String, sessionId: String?)
  case challenge(planItemId: String, sessionId: String?)
  case lesson(lessonId: String)
  case mistakePractice(skillId: String?)
  case mock(blockId: String, sessionId: String?)
  case pattern(patternId: String)
  case subscription
}

/// The question in view, for the buddy lane's Ask panel.
struct PracticeAskTarget: Equatable, Sendable {
  let itemId: String
  let question: String
  /// The answer was graded wrong: Ask says the buddy's name, when asking helps most.
  let missed: Bool
}

/// What other lanes plug into the practice screens, each a no-op until wired. The shell creates
/// one and keeps it (a reference, so views never re-render for it); see PRACTICE-CONTRACT.md.
final class PracticeHooks: Sendable {
  /// Opens a destination outside the practice screen: the shell's router.
  let navigate: @MainActor @Sendable (PracticeDestination) -> Void
  /// The buddy lane's Ask button for the question in view; nil hides Ask.
  let askButton: (@MainActor @Sendable (PracticeAskTarget) -> AnyView)?
  /// The voice lane's live call a language phase or final challenge plays instead of questions;
  /// nil shows the call's intro with its start unavailable.
  let challengeCall: (@MainActor @Sendable (_ planItemId: String) -> AnyView)?
  /// The milestones lane's full-screen moment for a milestone a run earned, before its result;
  /// nil shows the result alone.
  let ceremony:
    (
      @MainActor @Sendable (
        Components.Schemas.Milestone, _ onClose: @escaping @MainActor () -> Void
      ) -> AnyView
    )?

  init(
    navigate: @escaping @MainActor @Sendable (PracticeDestination) -> Void = { _ in },
    askButton: (@MainActor @Sendable (PracticeAskTarget) -> AnyView)? = nil,
    challengeCall: (@MainActor @Sendable (String) -> AnyView)? = nil,
    ceremony: (
      @MainActor @Sendable (Components.Schemas.Milestone, @escaping @MainActor () -> Void) ->
        AnyView
    )? = nil
  ) {
    self.navigate = navigate
    self.askButton = askButton
    self.challengeCall = challengeCall
    self.ceremony = ceremony
  }

  static let none = PracticeHooks()
}

extension EnvironmentValues {
  @Entry var practiceHooks: PracticeHooks = .none
}
