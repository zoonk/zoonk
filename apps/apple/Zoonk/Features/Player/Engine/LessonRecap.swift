import Foundation

/// Main's "From the lesson": the screen a question comes after, to read again beside it.
struct LessonRecap: Equatable {
  let step: LessonStep
  /// The sentence the question rests on, once it's missed, when the lesson writer quoted it from
  /// this screen word for word.
  let mark: String?
}

extension LessonPlayerState {
  /// None where "Explain first" can bring the explanation instead.
  var recap: LessonRecap? {
    guard let question = currentStep, !question.isRead,
      [.activity, .check, .hook, .typedAnswer].contains(question.kind),
      explanationsAfterCurrent.isEmpty
    else {
      return nil
    }

    let read = queue[..<position].compactMap { steps[$0] }.filter(\.isRecapped)
      .sorted { $0.position < $1.position }
    let isChecked = phase == .feedback && currentResult != nil

    // A screen written after the question was written knowing it and may answer it.
    guard
      let step = read.last(where: { $0.position < question.position })
        ?? (isChecked ? read.first { $0.position > question.position } : nil)
    else {
      return nil
    }

    let isMissed = isChecked && currentResult?.isCorrect == false
    return LessonRecap(step: step, mark: isMissed ? question.basisQuote(on: step) : nil)
  }
}

extension LessonStep {
  fileprivate var isRecapped: Bool {
    switch content {
    case .explanation, .workedExample: true
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
