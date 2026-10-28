import Foundation

/// One question of a mistake practice run, with the mistake it drills.
struct MistakePracticeStep: Equatable {
  let entry: MistakePracticeEntry
  let isFirstOfEntry: Bool
  let question: PracticeQuestion

  /// The question the mistake was made on: the notebook keeps a lesson's question with its context
  /// before it, and a bank question as it's asked. Its drill note says the last answer.
  var isMistakeQuestion: Bool {
    let saved = Self.squash(entry.snapshotQuestion)
    return saved == Self.squash(question.question)
      || (question.context.map { saved == Self.squash("\($0) \(question.question)") } ?? false)
  }

  private static func squash(_ text: String) -> String {
    text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
  }
}

/// Where the run is: a gap's idea before its questions, a misread's question before its answers,
/// answering, waiting for the grade, reading it, counting the run, or done.
enum MistakePracticePhase: Equatable {
  case answerFailed(answer: PracticeAnswer, timedOut: Bool)
  case answering
  case checking(answer: PracticeAnswer, timedOut: Bool)
  case ended(Components.Schemas.MistakePracticeCompletion?)
  case ending
  case feedback(answer: PracticeAnswer, grade: MistakePracticeGrade, timedOut: Bool)
  case idea
  case reading
}

/// "Practice mistakes": each mistake's drill question by question. The run keeps the questions it
/// started with (a fixed mistake leaves the server's practice, not the run in progress), every
/// answer's id for counting the run, the mistakes it fixed, each question's verdict for the
/// header, and what every count reached, so its end celebrates the whole run.
struct MistakePracticeState: Equatable {
  private(set) var answerIds: [String] = []
  private(set) var fixedIds: [String] = []
  private(set) var index = 0
  private(set) var phase: MistakePracticePhase
  private(set) var reached = PracticeReached.nothing
  let steps: [MistakePracticeStep]
  private(set) var verdicts: [PracticeSegment] = []

  init(entries: [MistakePracticeEntry]) {
    steps = entries.flatMap { entry in
      entry.questions.enumerated().map { position, question in
        MistakePracticeStep(entry: entry, isFirstOfEntry: position == 0, question: question)
      }
    }
    phase = steps.isEmpty ? .ended(nil) : Self.opening(steps.first)
  }

  var step: MistakePracticeStep? { steps.indices.contains(index) ? steps[index] : nil }

  /// The question's answer can be sent: answering, or again after a save that didn't go through.
  var acceptsAnswer: Bool {
    switch phase {
    case .answering, .answerFailed: true
    default: false
    }
  }

  var isOver: Bool {
    switch phase {
    case .ending, .ended: true
    default: false
    }
  }

  /// A content gap's first question waits behind its idea; a misread's show answers once read.
  private static func opening(_ step: MistakePracticeStep?) -> MistakePracticePhase {
    guard let step else { return .ending }
    if step.isFirstOfEntry, step.entry.drill.isIdeaFirst { return .idea }
    return step.entry.drill.isReadFirst ? .reading : .answering
  }

  mutating func start() {
    phase = step?.entry.drill.isReadFirst == true ? .reading : .answering
  }

  mutating func reveal() {
    phase = .answering
  }

  mutating func check(_ answer: PracticeAnswer, timedOut: Bool) {
    phase = .checking(answer: answer, timedOut: timedOut)
  }

  mutating func answerFailed() {
    guard case .checking(let answer, let timedOut) = phase else { return }
    phase = .answerFailed(answer: answer, timedOut: timedOut)
  }

  mutating func answered(_ grade: MistakePracticeGrade, mistakeId: String) {
    guard case .checking(let answer, let timedOut) = phase else { return }

    answerIds.append(grade.answerId)

    var fixed = fixedIds
    for id in grade.fixedMistakeIds where !fixed.contains(id) { fixed.append(id) }
    if grade.isStillOpen {
      fixed.removeAll { $0 == mistakeId }
    } else if grade.fixed, !fixed.contains(mistakeId) {
      fixed.append(mistakeId)
    }
    fixedIds = fixed

    reached = reached.merged(with: grade.reached)
    // An explicit "not sure" is neutral; the clock running out stays a miss.
    verdicts.append(!timedOut && answer.isDontKnow ? .read : (grade.isCorrect ? .right : .wrong))
    phase = .feedback(answer: answer, grade: grade, timedOut: timedOut)
  }

  mutating func next() {
    index += 1
    phase = Self.opening(step)
  }

  mutating func end() {
    phase = .ending
  }

  mutating func ended(_ summary: Components.Schemas.MistakePracticeCompletion?) {
    if let summary, let level = summary.reached.level {
      reached = reached.merged(
        with: PracticeReached(
          energy: summary.reached.energy,
          level: .init(color: level.color.rawValue, level: level.level)))
    } else if let energy = summary?.reached.energy {
      reached = reached.merged(with: PracticeReached(energy: energy, level: nil))
    }
    phase = .ended(summary)
  }

  /// Each question as a header segment: answered right or wrong, neutral for "not sure", the one
  /// in view, then the ones ahead.
  var segments: [PracticeSegment] {
    steps.indices.map { position in
      if verdicts.indices.contains(position) { return verdicts[position] }
      return position == index ? .current : .ahead
    }
  }
}
