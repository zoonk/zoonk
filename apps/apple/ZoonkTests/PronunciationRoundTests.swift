import XCTest

@testable import Zoonk

@MainActor
final class PronunciationRoundTests: XCTestCase {
  private let recording = VoiceRecording(audio: Data([1]), durationMs: 800)

  func testAWordSaidRightThenTheRoundCountsOnce() async {
    let server = Server(grades: [.graded(.fixture(isCorrect: true))])
    let round = PronunciationRound(words: [.fixture("a")], actions: server.actions)

    await round.record(recording)
    XCTAssertEqual(round.outcomes, [0: .right])

    await round.next()
    XCTAssertEqual(round.step, .result(.fixture))
    XCTAssertEqual(server.answered, ["a"])
    XCTAssertEqual(server.finished, [round.roundId])
  }

  func testTryingAgainStartsTheWordOver() async {
    let server = Server(grades: [
      .graded(.fixture(isCorrect: false)), .graded(.fixture(isCorrect: true)),
    ])
    let round = PronunciationRound(words: [.fixture("a")], actions: server.actions)

    await round.record(recording)
    XCTAssertEqual(round.outcomes, [0: .wrong])

    round.tryAgain()
    XCTAssertEqual(round.step, .word(index: 0, state: .ready(nil)))
    XCTAssertEqual(round.outcomes, [:])

    await round.record(recording)
    XCTAssertEqual(round.outcomes, [0: .right])
  }

  func testNothingSaidEndsWithoutCountingTheRound() async {
    let server = Server(grades: [])
    let round = PronunciationRound(words: [.fixture("a"), .fixture("b")], actions: server.actions)

    await round.next()
    await round.next()

    XCTAssertEqual(round.step, .result(nil))
    XCTAssertEqual(round.outcomes, [0: .skipped, 1: .skipped])
    XCTAssertTrue(server.finished.isEmpty)
  }

  func testARecordingWithoutWordsOrALimitKeepsTheWord() async {
    let server = Server(grades: [.noSpeech, .limit(.signUpRequired), .failed, .obsolete])
    let round = PronunciationRound(words: [.fixture("a")], actions: server.actions)

    await round.record(recording)
    XCTAssertEqual(round.step, .word(index: 0, state: .ready(.noSpeech)))

    await round.record(recording)
    XCTAssertEqual(round.step, .word(index: 0, state: .ready(.limit(.signUpRequired))))

    await round.record(recording)
    XCTAssertEqual(round.step, .word(index: 0, state: .ready(.failed)))

    await round.record(recording)
    XCTAssertEqual(round.step, .word(index: 0, state: .ready(.failed)))
    XCTAssertEqual(round.outcomes, [:])
  }

  func testAFailedFinishCanBeRetried() async {
    let server = Server(grades: [.graded(.fixture(isCorrect: true))], finishFails: 1)
    let round = PronunciationRound(words: [.fixture("a")], actions: server.actions)

    await round.record(recording)
    await round.next()
    XCTAssertTrue(round.finishFailed)

    await round.finish()
    XCTAssertFalse(round.finishFailed)
    XCTAssertEqual(round.step, .result(.fixture))
  }

  func testNoWordsDueShowsTheEndAtOnce() {
    let round = PronunciationRound(words: [], actions: Server(grades: []).actions)
    XCTAssertEqual(round.step, .result(nil))
  }
}

@MainActor
private final class Server {
  private var grades: [GradeOutcome<PronunciationRound.Grade>]
  private var finishFails: Int
  private(set) var answered: [String] = []
  private(set) var finished: [String] = []

  init(grades: [GradeOutcome<PronunciationRound.Grade>], finishFails: Int = 0) {
    self.grades = grades
    self.finishFails = finishFails
  }

  var actions: PronunciationRound.Actions {
    PronunciationRound.Actions(
      answer: { reviewId, _, _ in
        self.answered.append(reviewId)
        return self.grades.removeFirst()
      },
      finish: { roundId in
        self.finished.append(roundId)

        if self.finishFails > 0 {
          self.finishFails -= 1
          return .failed(.network)
        }

        return .done(.fixture)
      })
  }
}

extension PronunciationRound.Word {
  fileprivate static func fixture(_ id: String) -> Self {
    .init(audioUrl: nil, id: id, respelling: "AH", romanization: nil, tip: nil, word: id)
  }
}

extension PronunciationRound.Grade {
  fileprivate static func fixture(isCorrect: Bool) -> Self {
    .init(attemptId: "attempt", isCorrect: isCorrect, nextReviewAt: nil, transcript: "a")
  }
}

extension PronunciationRound.Result {
  fileprivate static let fixture = Self(
    ceremony: nil, reached: .init(energy: nil, level: nil), brainPower: 5, correct: 1,
    missionMoment: nil, total: 1)
}
