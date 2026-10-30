import XCTest

@testable import Zoonk

@MainActor
final class LevelTestAudioTests: XCTestCase {
  private struct Unavailable: Error {}

  /// Replies in order, repeating the last one.
  private final class Reads {
    private var replies: [Result<LevelTest, Error>]
    private(set) var calls = 0

    init(_ replies: [Result<LevelTest, Error>]) {
      self.replies = replies
    }

    func next() throws -> LevelTest {
      calls += 1
      return try (replies.count > 1 ? replies.removeFirst() : replies[0]).get()
    }
  }

  private static let clip = URL(string: "https://cdn.zoonk.test/clips/listening-1.mp3")!

  private func question(
    id: String = "listening-1", audio: URL? = nil, pending: Bool = false
  ) -> LevelTest.Question {
    LevelTest.Question(
      id: id, options: ["A", "B"], passage: "Hallo, hier ist Anna.", question: "Who calls?",
      skill: .listening, audio: audio.map(LevelTest.Question.Audio.init), audioPending: pending)
  }

  private func test(showing question: LevelTest.Question) -> LevelTest {
    LevelTest(
      status: .ready, startedAt: nil, answered: 2, total: 10, levels: [],
      next: LevelTest.Next(kind: "question", question: question, speaking: nil))
  }

  func testTheQuestionTakesItsClipOnceAReadHasIt() async throws {
    let reads = Reads([
      .success(test(showing: question(pending: true))),
      .success(test(showing: question(audio: Self.clip))),
    ])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question(audio: Self.clip))
    XCTAssertEqual(reads.calls, 2)
  }

  func testTheWaitEndsWithoutAClipWhenTheRunStopsMakingIt() async throws {
    let reads = Reads([.success(test(showing: question()))])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question())
    XCTAssertEqual(reads.calls, 1)
  }

  func testThreeFailedReadsInARowEndTheWait() async throws {
    let reads = Reads([.failure(Unavailable())])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question())
    XCTAssertEqual(reads.calls, 3)
  }

  func testAReadThatWorksStartsTheFailuresOver() async throws {
    let reads = Reads([
      .failure(Unavailable()), .failure(Unavailable()),
      .success(test(showing: question(pending: true))),
      .failure(Unavailable()), .failure(Unavailable()),
      .success(test(showing: question(audio: Self.clip))),
    ])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question(audio: Self.clip))
    XCTAssertEqual(reads.calls, 6)
  }

  func testAReadFromBeforeTheAnswerDoesntEndTheWait() async throws {
    let reads = Reads([
      .success(test(showing: question(id: "reading-1"))),
      .success(test(showing: question(audio: Self.clip))),
    ])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question(audio: Self.clip))
    XCTAssertEqual(reads.calls, 2)
  }

  func testThreeReadsShowingAnotherQuestionEndTheWait() async throws {
    let reads = Reads([.success(test(showing: question(id: "reading-2")))])

    let shown = try await question(pending: true).waitingForAudio(every: .zero) {
      try reads.next()
    }

    XCTAssertEqual(shown, question())
    XCTAssertEqual(reads.calls, 3)
  }
}
