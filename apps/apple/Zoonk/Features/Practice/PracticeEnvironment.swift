import SwiftUI

enum PracticeChange: Equatable, Sendable {
  case answered
  case finished
  case planChanged
  case patternDone
}

enum PracticeDestination: Equatable, Sendable {
  case checkpoint(blockId: String, sessionId: String?)
  case challenge(planItemId: String, sessionId: String?)
  case lesson(lessonId: String)
  case mistakePractice(skillId: String?)
  case mock(blockId: String, sessionId: String?)
  case pattern(patternId: String)
  case plan
  case subscription
  case today
}

struct PracticeAskTarget: Equatable, Sendable {
  let itemId: String
  let question: String
  /// The study block it's asked in; nil in mistake practice, which isn't a block.
  let blockId: String?
  /// The buddy may now talk about the answer, not only the question.
  let answered: Bool
  /// Ask says the buddy's name, when asking helps most.
  let missed: Bool
}

/// A language unit's checkpoint is a live call, which main's checkpoint page reads before the
/// checkpoint.
struct PracticeCheckpointCall: Sendable {
  let read:
    @MainActor @Sendable (_ blockId: String, _ token: String) async throws ->
      Components.Schemas.LanguageCheckpointCall
  /// The call's screen brings its own title, close and intro.
  let screen: @MainActor @Sendable (_ blockId: String) -> AnyView
}

/// Each hook is a no-op until set. A reference, so views never re-render for it.
final class PracticeHooks: Sendable {
  let navigate: @MainActor @Sendable (PracticeDestination) -> Void
  /// Nil hides Ask.
  let askButton: (@MainActor @Sendable (PracticeAskTarget) -> AnyView)?
  /// Nil reads every checkpoint as a duel or the week's challenge.
  let checkpointCall: PracticeCheckpointCall?

  init(
    navigate: @escaping @MainActor @Sendable (PracticeDestination) -> Void = { _ in },
    askButton: (@MainActor @Sendable (PracticeAskTarget) -> AnyView)? = nil,
    checkpointCall: PracticeCheckpointCall? = nil
  ) {
    self.navigate = navigate
    self.askButton = askButton
    self.checkpointCall = checkpointCall
  }

  static let none = PracticeHooks()
}

extension EnvironmentValues {
  @Entry var practiceHooks: PracticeHooks = .none
}
