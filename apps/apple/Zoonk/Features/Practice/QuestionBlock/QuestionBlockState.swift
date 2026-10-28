import Foundation

/// Where a question block is: answering, waiting for the grade, reading it, or finished.
enum QuestionBlockPhase: Equatable {
  case alreadyAnswered
  case answerFailed
  case answering
  case checking
  case feedback(answer: PracticeAnswer, feedback: PracticeFeedback)
  case finishFailed
  case finished(Components.Schemas.StudyBlockCompletion)
  /// A block opened again with every answer in: finishing can prepare the rest of the day, so it
  /// waits for the learner's tap.
  case finishReady
  case finishing

  /// Before the grade: answering, checking, or answering again after a failed save.
  var isAnswering: Bool { self == .answering || self == .checking || self == .answerFailed }

  /// The answer can be sent: answering, or again after a save that didn't go through.
  var acceptsAnswer: Bool { self == .answering || self == .answerFailed }
}

/// Right, wrong and blank so far, for a net-scored block's score: a wrong answer cancels a right one.
struct NetTally: Equatable {
  var blank: Int
  var right: Int
  var wrong: Int

  var net: Int { right - wrong }
}

/// A question block played one question at a time, graded on the server, resuming at the first
/// unanswered question. `answers` holds this visit's grades; the block's own `answered` marks the
/// ones saved before it, so a reload still counts a blank as neither right nor wrong.
struct QuestionBlockState: Equatable {
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

  // MARK: Transitions

  mutating func check() {
    phase = .checking
  }

  mutating func answered(_ answer: PracticeAnswer, feedback: PracticeFeedback, itemId: String) {
    answers[itemId] = PracticeAnsweredMark(blank: feedback.blank, isCorrect: feedback.isCorrect)
    hyperdrive = feedback.hyperdrive.level
    phase = .feedback(answer: answer, feedback: feedback)
  }

  mutating func answerFailed() {
    phase = .answerFailed
  }

  mutating func alreadyAnswered() {
    phase = .alreadyAnswered
  }

  /// On to the next question, or to finishing after the last one.
  mutating func next() {
    index += 1
    phase = index >= questions.count ? .finishing : .answering
  }

  mutating func finish() {
    phase = .finishing
  }

  mutating func finishFailed() {
    phase = .finishFailed
  }

  mutating func finished(_ completion: Components.Schemas.StudyBlockCompletion) {
    phase = .finished(completion)
  }

  // MARK: Derived

  /// Each question's segment: right or wrong once answered (this visit's or saved before), read
  /// for a placement question or a blank, the one in view, and the rest ahead.
  var segments: [PracticeSegment] {
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
  /// Scored net (Cebraspe), where a wrong answer cancels a right one: a swipe capsule's question,
  /// or a net-scored practice block's.
  func isNetScored(_ question: PracticeQuestion?) -> Bool {
    if let capsule = block.capsules.first(where: { $0.key == question?.capsuleKey }) {
      return capsule.format == .swipe
    }

    return block.netScored
  }

  /// Whether the question before this one was on the same text, case or recording.
  func continuesSet(at index: Int) -> Bool {
    guard index > 0, questions.indices.contains(index), let set = questions[index].set else {
      return false
    }

    return questions[index - 1].set?.id == set.id
  }

  /// The questions on the current one's recording, in order, to read before it plays.
  func recordingQuestions(for question: PracticeQuestion) -> (prompts: [String], current: Int)? {
    guard let setId = question.set?.id, question.set?.listening != nil else { return nil }

    let onRecording = questions.filter { $0.set?.id == setId }
    return (
      onRecording.map(\.question), onRecording.firstIndex { $0.itemId == question.itemId } ?? 0
    )
  }
}

/// Where a saved mistake's drill stands before its question opens: a content gap's idea first,
/// a misread's question before its answers, then open.
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
