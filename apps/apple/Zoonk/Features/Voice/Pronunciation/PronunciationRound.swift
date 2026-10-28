import Foundation
import Observation

/// One round of pronunciation reviews, as main's `usePronunciationRound` runs it: each word is
/// heard, said and graded before the next one; a word that still sounds different can be tried
/// again or skipped. The round is counted once, at the end, and only when a word was said. The
/// round keeps the words it started with, even if grading changes what's due.
@MainActor
@Observable
final class PronunciationRound {
  typealias Word = Components.Schemas.PronunciationReviewWord
  typealias Grade = Components.Schemas.PronunciationAnswerGrade
  typealias Result = Components.Schemas.PronunciationRoundResult

  /// Why the last recording wasn't graded.
  enum Notice: Equatable {
    case failed
    case noSpeech
    case limit(HelpLimit)
  }

  enum WordState: Equatable {
    case ready(Notice?)
    case graded(Grade)
  }

  enum Step: Equatable {
    case word(index: Int, state: WordState)
    /// The round's end: what it earned, or nil when nothing was said.
    case result(Result?)
  }

  /// How a word went, for its part of the header's meter.
  enum Outcome: Equatable {
    case right
    case wrong
    case skipped
  }

  struct Actions {
    let answer:
      @MainActor (_ reviewId: String, _ roundId: String, VoiceRecording) async -> GradeOutcome<
        Grade
      >
    let finish: @MainActor (_ roundId: String) async -> MutationResult<Result>
  }

  let words: [Word]
  let roundId = UUID().uuidString.lowercased()
  private(set) var step: Step
  private(set) var outcomes: [Int: Outcome] = [:]
  private(set) var isPending = false
  private(set) var finishFailed = false
  @ObservationIgnored private var answered = 0
  @ObservationIgnored private let actions: Actions

  init(words: [Word], actions: Actions) {
    self.words = words
    self.actions = actions
    step = words.isEmpty ? .result(nil) : .word(index: 0, state: .ready(nil))
  }

  var index: Int {
    if case .word(let index, _) = step {
      return index
    }

    return words.count
  }

  var current: Word? {
    words.indices.contains(index) ? words[index] : nil
  }

  var isLast: Bool {
    index + 1 == words.count
  }

  /// Grades the current word said out loud. A request that didn't get through says so, and the
  /// word waits to be said again.
  func record(_ recording: VoiceRecording) async {
    guard case .word(let index, _) = step, let word = current else {
      return
    }

    isPending = true
    defer { isPending = false }

    switch await actions.answer(word.id, roundId, recording) {
    case .graded(let grade):
      answered += 1
      outcomes[index] = grade.isCorrect ? .right : .wrong
      step = .word(index: index, state: .graded(grade))
    case .noSpeech:
      step = .word(index: index, state: .ready(.noSpeech))
    case .limit(let limit):
      step = .word(index: index, state: .ready(.limit(limit)))
    case .failed:
      step = .word(index: index, state: .ready(.failed))
    case .obsolete:
      break
    }
  }

  /// Trying again starts the word over, so its part waits for the new grade.
  func tryAgain() {
    guard case .word(let index, _) = step else {
      return
    }

    outcomes[index] = nil
    step = .word(index: index, state: .ready(nil))
  }

  /// Goes on to the next word, or ends the round. A word left without a grade was skipped.
  func next() async {
    guard case .word(let index, _) = step else {
      return
    }

    if outcomes[index] == nil {
      outcomes[index] = .skipped
    }

    if index + 1 < words.count {
      step = .word(index: index + 1, state: .ready(nil))
      return
    }

    await finish()
  }

  /// Counts the round toward the learner's day; with nothing said there's nothing to count.
  func finish() async {
    guard answered > 0 else {
      step = .result(nil)
      return
    }

    isPending = true
    finishFailed = false
    defer { isPending = false }

    switch await actions.finish(roundId) {
    case .done(let result):
      step = .result(result)
    case .failed:
      finishFailed = true
    case .obsolete:
      break
    }
  }
}
