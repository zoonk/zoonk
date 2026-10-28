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
  case subscription
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

/// Each hook is a no-op until set. A reference, so views never re-render for it.
final class PracticeHooks: Sendable {
  let navigate: @MainActor @Sendable (PracticeDestination) -> Void
  /// Nil hides Ask.
  let askButton: (@MainActor @Sendable (PracticeAskTarget) -> AnyView)?
  /// Nil shows the call's intro with its start unavailable.
  let challengeCall: (@MainActor @Sendable (_ planItemId: String) -> AnyView)?
  /// Nil says the challenge isn't ready here.
  let checkpointCall: (@MainActor @Sendable (_ blockId: String, _ sessionId: String?) -> AnyView)?
  /// Nil shows the result alone.
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
    checkpointCall: (@MainActor @Sendable (String, String?) -> AnyView)? = nil,
    ceremony: (
      @MainActor @Sendable (Components.Schemas.Milestone, @escaping @MainActor () -> Void) ->
        AnyView
    )? = nil
  ) {
    self.navigate = navigate
    self.askButton = askButton
    self.challengeCall = challengeCall
    self.checkpointCall = checkpointCall
    self.ceremony = ceremony
  }

  static let none = PracticeHooks()
}

extension EnvironmentValues {
  @Entry var practiceHooks: PracticeHooks = .none
}
