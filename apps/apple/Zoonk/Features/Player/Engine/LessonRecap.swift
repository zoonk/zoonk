import Foundation

/// Main's "From the lesson": the screen a question comes after, to read again beside it.
struct LessonRecap: Equatable {
  let step: LessonStep
  /// The sentence the question rests on, once it's missed, when the lesson writer quoted it from
  /// this screen word for word.
  let mark: String?
}

extension LessonPlayerState {
  /// Main's `getLessonRecap`: the explanation, worked example or hook text the question in view
  /// comes after. None where "Explain first" can bring the explanation instead.
  var recap: LessonRecap? {
    guard let question = currentStep, !question.isRead,
      [.activity, .check, .hook, .typedAnswer].contains(question.kind),
      explanationsAfterCurrent.isEmpty,
      let id = queue[..<firstPlace(of: question)].last(where: { steps[$0]?.isRecapped == true }),
      let step = steps[id]
    else {
      return nil
    }

    let isMissed = phase == .feedback && currentResult?.isCorrect == false
    return LessonRecap(step: step, mark: isMissed ? question.basisQuote(on: step) : nil)
  }

  /// A missed question that gave up its place for the end (a missed quick check) recaps from where
  /// it was written.
  private func firstPlace(of step: LessonStep) -> Int {
    guard let first = queue.firstIndex(of: step.id) else {
      return 0
    }

    guard retried.contains(step.id), queue.lastIndex(of: step.id) == first,
      let later = queue.firstIndex(where: { (steps[$0]?.position ?? 0) > step.position })
    else {
      return first
    }

    return min(first, later)
  }
}

extension LessonStep {
  fileprivate var isRecapped: Bool {
    switch content {
    case .explanation, .workedExample: true
    case .hook(let hook): hook.variant == .text
    default: false
    }
  }

  fileprivate func basisQuote(on recapped: LessonStep) -> String? {
    let basis: LessonBasis? =
      switch content {
      case .check(let check): check.basis
      case .typedAnswer(let typed): typed.basis
      default: nil
      }

    return basis?.position == recapped.position ? basis?.quote : nil
  }
}
