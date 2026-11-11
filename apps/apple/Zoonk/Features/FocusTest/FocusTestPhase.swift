import Foundation

/// A question of an open sitting, with the sitting it counts in.
struct FocusTestQuestion: Equatable {
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
  let sitting: FocusTest.Sitting
}

/// What the Focus test shows, from its placement read. Main's `toFocusTestPhase`.
enum FocusTestPhase: Equatable {
  case loading
  case unavailable
  /// `answered`: the learner has test answers, so leaving the wait uses them.
  case waiting(answered: Bool, failure: GenerationFailure?)
  case invitation(FocusTest, next: FocusTest.NextSitting)
  case resume(FocusTestQuestion)
  case question(FocusTestQuestion)
  /// A sitting that's over and not closed yet: the learner came back to it, or closing it failed.
  case ended(FocusTest.Sitting.End?)
  case checkpoint(FocusTest, end: FocusTest.Sitting.End?)

  var isWaiting: Bool {
    if case .waiting = self { true } else { false }
  }

  /// `opening` is the screen's first read, which never drops the learner into a question: a sitting
  /// with answers shows its resume screen, and one without is offered again.
  init(_ placement: GoalPlacement, opening: Bool) {
    let focusTest = placement.focusTest.flatMap { try? PracticeJSON.recode($0, as: FocusTest.self) }

    switch placement.status {
    case .unavailable, .failed:
      self = .unavailable
    case .preparing, .waitingForQuestions:
      let resting = opening && focusTest?.sitting == nil ? focusTest.flatMap(Self.resting) : nil
      self = resting ?? .waiting(answered: focusTest?.checkpoint != nil, failure: nil)
    case .asking, .done:
      guard let focusTest else {
        self = .unavailable
        return
      }

      guard let sitting = focusTest.sitting else {
        self = Self.resting(focusTest) ?? .unavailable
        return
      }

      guard let next = placement.next,
        let question = try? PracticeJSON.recode(next, as: PracticeQuestion.self)
      else {
        self = .ended(sitting.end)
        return
      }

      let asked = FocusTestQuestion(
        question: question,
        labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
        sitting: sitting)

      if !opening {
        self = .question(asked)
      } else if sitting.answered > 0 {
        self = .resume(asked)
      } else {
        self = Self.resting(focusTest) ?? .question(asked)
      }
    }
  }

  /// Nil when there's no result to show and nothing to offer.
  static func resting(_ focusTest: FocusTest) -> Self? {
    if focusTest.checkpoint != nil {
      return .checkpoint(focusTest, end: nil)
    }

    return focusTest.nextSitting.map { .invitation(focusTest, next: $0) }
  }
}
