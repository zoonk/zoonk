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
  case invitation(FocusTest)
  case question(FocusTestQuestion)
  /// A sitting that's over and not closed yet: the learner came back to it, or closing it failed.
  case ended
  case checkpoint(FocusTest)

  var isWaiting: Bool {
    if case .waiting = self { true } else { false }
  }

  /// A wait nothing went wrong in, which reads until its questions come.
  var readsForQuestions: Bool {
    if case .waiting(_, failure: nil) = self { true } else { false }
  }

  init(_ placement: GoalPlacement, opening: Bool) {
    self.init(
      status: placement.status,
      focusTest: placement.focusTest.flatMap { try? PracticeJSON.recode($0, as: FocusTest.self) },
      next: placement.next.flatMap { try? PracticeJSON.recode($0, as: PracticeQuestion.self) },
      labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse,
      opening: opening)
  }

  /// `opening` is the screen's first read: with no sitting open, it offers the test or shows its
  /// result while questions are written; an open sitting goes on with its next question.
  init(
    status: Components.Schemas.PlacementStatus, focusTest: FocusTest?, next: PracticeQuestion?,
    labels: PracticeTrueFalseLabels, opening: Bool
  ) {
    switch status {
    case .unavailable:
      self = .unavailable
    case .preparing, .waitingForQuestions, .failed:
      let resting = opening && focusTest?.sitting == nil ? focusTest.flatMap(Self.resting) : nil
      self =
        resting
        ?? .waiting(
          answered: focusTest?.checkpoint != nil, failure: status == .failed ? .generation : nil)
    case .asking, .done:
      guard let focusTest else {
        self = .unavailable
        return
      }

      guard let sitting = focusTest.sitting else {
        self = Self.resting(focusTest) ?? .unavailable
        return
      }

      guard let next else {
        self = .ended
        return
      }

      let asked = FocusTestQuestion(question: next, labels: labels, sitting: sitting)

      self = .question(asked)
    }
  }

  /// Nil when there's no result to show and nothing to offer.
  static func resting(_ focusTest: FocusTest) -> Self? {
    if focusTest.checkpoint != nil {
      return .checkpoint(focusTest)
    }

    return focusTest.offer == nil ? nil : .invitation(focusTest)
  }
}
