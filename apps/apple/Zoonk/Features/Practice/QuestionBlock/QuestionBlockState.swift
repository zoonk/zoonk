import Foundation

struct SentAnswer: Equatable {
  let answer: PracticeAnswer
  let sender: AnswerSender
  let durationMs: Int
}

extension SentAnswer {
  /// An answer sent again unchanged after it failed to save keeps the time it first took: a timed
  /// drill grades that time, and the wait on the failure isn't the learner's.
  init(answer: PracticeAnswer, sender: AnswerSender, measuredMs: Int, failed: SentAnswer?) {
    let resent = failed.flatMap { $0.answer == answer ? $0.durationMs : nil }
    self.init(answer: answer, sender: sender, durationMs: resent ?? measuredMs)
  }
}

enum QuestionBlockPhase: Equatable {
  case alreadyAnswered
  case answerFailed(SentAnswer)
  case answering
  case checking(SentAnswer)
  case feedback(answer: PracticeAnswer, feedback: PracticeFeedback)
  case finishFailed
  case finished(Components.Schemas.StudyBlockCompletion)
  /// A block opened again with every answer in: finishing can prepare the rest of the day, so it
  /// waits for the learner's tap.
  case finishReady
  case finishing

  var acceptsAnswer: Bool {
    switch self {
    case .answering, .answerFailed: true
    default: false
    }
  }

  var checking: AnswerSender? {
    if case .checking(let sent) = self { sent.sender } else { nil }
  }

  var failed: SentAnswer? {
    if case .answerFailed(let sent) = self { sent } else { nil }
  }
}

/// A wrong answer cancels a right one.
struct NetTally: Equatable {
  var blank: Int
  var right: Int
  var wrong: Int

  var net: Int { right - wrong }
}

/// `answers` holds this visit's grades; the block's own `answered` marks the ones saved before it,
/// so a reload still counts a blank as neither right nor wrong.
struct QuestionBlockState: Equatable {
  private(set) var saveFailures = 0
  private(set) var answers: [String: PracticeAnsweredMark] = [:]
  private(set) var hyperdrive = 1
  private(set) var index: Int
  private(set) var phase: QuestionBlockPhase
  let questions: [PracticeQuestion]

  init(questions: [PracticeQuestion]) {
    self.questions = questions
    let first = questions.firstIndex { $0.answered == nil } ?? questions.count
    index = first
    phase = first >= questions.count ? .finishReady : .answering
  }

  var question: PracticeQuestion? {
    questions.indices.contains(index) ? questions[index] : nil
  }

  var total: Int { questions.count }

  mutating func check(_ sent: SentAnswer) {
    phase = .checking(sent)
  }

  mutating func answered(_ answer: PracticeAnswer, feedback: PracticeFeedback, itemId: String) {
    saveFailures = 0
    answers[itemId] = PracticeAnsweredMark(blank: feedback.blank, isCorrect: feedback.isCorrect)
    hyperdrive = feedback.hyperdrive.level
    phase = .feedback(answer: answer, feedback: feedback)
  }

  mutating func answerFailed() {
    guard case .checking(let sent) = phase else { return }
    saveFailures += 1
    phase = .answerFailed(sent)
  }

  mutating func alreadyAnswered() {
    saveFailures = 0
    phase = .alreadyAnswered
  }

  mutating func next() {
    index += 1
    phase = index >= questions.count ? .finishing : .answering
  }

  mutating func finish() {
    phase = .finishing
  }

  mutating func finishFailed() {
    saveFailures += 1
    phase = .finishFailed
  }

  mutating func finished(_ completion: Components.Schemas.StudyBlockCompletion) {
    saveFailures = 0
    phase = .finished(completion)
  }

  var segments: [TaskSegment] {
    questions.enumerated().map { position, question in
      guard let mark = answers[question.itemId] ?? question.answered else {
        return position == index ? .current : .ahead
      }

      if question.placement || mark.blank {
        return .read
      }

      return mark.isCorrect ? .right : .wrong
    }
  }

  var netTally: NetTally {
    let graded = questions.compactMap { answers[$0.itemId] ?? $0.answered }
    let right = graded.filter(\.isCorrect).count
    let blank = graded.filter { !$0.isCorrect && $0.blank }.count
    return NetTally(blank: blank, right: right, wrong: graded.count - right - blank)
  }
}

extension QuestionBlockDetail {
  /// Cebraspe's net scoring, where a wrong answer cancels a right one.
  func isNetScored(_ question: PracticeQuestion?) -> Bool {
    if let capsule = block.capsules.first(where: { $0.key == question?.capsuleKey }) {
      return capsule.format == .swipe
    }

    return block.netScored
  }

  func continuesSet(at index: Int) -> Bool {
    guard index > 0, questions.indices.contains(index), let set = questions[index].set else {
      return false
    }

    return questions[index - 1].set?.id == set.id
  }

  func recordingQuestions(for question: PracticeQuestion) -> (prompts: [String], current: Int)? {
    guard let setId = question.set?.id, question.set?.listening != nil else { return nil }

    let onRecording = questions.filter { $0.set?.id == setId }
    return (
      onRecording.map(\.question), onRecording.firstIndex { $0.itemId == question.itemId } ?? 0
    )
  }
}

enum DrillStage: Equatable {
  case idea
  case open
  case reading

  /// A gap's idea opens only on the first question of its drill; a misread reads every one first.
  static func opening(drill: PracticeDrill?, isFirstOfDrill: Bool) -> DrillStage {
    if isFirstOfDrill, drill?.isIdeaFirst == true {
      return .idea
    }

    return drill?.isReadFirst == true ? .reading : .open
  }

  /// After the idea screen's Start: a misread still reads first.
  static func afterIdea(drill: PracticeDrill?) -> DrillStage {
    drill?.isReadFirst == true ? .reading : .open
  }
}
