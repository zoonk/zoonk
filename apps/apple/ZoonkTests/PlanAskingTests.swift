import XCTest

@testable import Zoonk

@MainActor
final class PlanAskingTests: XCTestCase {
  private struct Answer: PlanAnswer {
    let id: Int
    let ready: Bool
  }

  private struct Unavailable: Error {}

  /// Replies in order, repeating the last one.
  private final class Replies {
    private var replies: [Result<Answer, Error>]
    private(set) var calls = 0

    init(_ replies: [Result<Answer, Error>]) {
      self.replies = replies
    }

    func next() throws -> Answer {
      calls += 1
      return try (replies.count > 1 ? replies.removeFirst() : replies[0]).get()
    }
  }

  private func makeAsking(patience: Duration = .seconds(60)) -> PlanAsking<String, Answer> {
    PlanAsking(interval: .milliseconds(1), settle: .milliseconds(1), patience: patience)
  }

  func testAsksAgainWhileThePlanIsntReady() async {
    let asking = makeAsking()
    let replies = Replies([
      .success(Answer(id: 1, ready: false)), .success(Answer(id: 2, ready: true)),
    ])

    await asking.ask("week", when: true) { try replies.next() }

    XCTAssertEqual(replies.calls, 2)
    XCTAssertEqual(asking.answer(for: "week")?.id, 2)
    XCTAssertEqual(asking.first?.id, 2)
    XCTAssertEqual(asking.status, .idle)
  }

  func testGoingBackToAnEarlierChoiceAsksNothingNew() async {
    let asking = makeAsking()
    let replies = Replies([
      .success(Answer(id: 1, ready: true)), .success(Answer(id: 2, ready: true)),
    ])

    await asking.ask("a", when: true) { try replies.next() }
    await asking.ask("b", when: true) { try replies.next() }
    await asking.ask("a", when: true) { try replies.next() }

    XCTAssertEqual(replies.calls, 2)
    XCTAssertEqual(asking.answer(for: "a")?.id, 1)
    XCTAssertEqual(asking.first?.id, 1)
  }

  func testShowsTheLastReadyAnswerWhileANewChoiceIsAsked() async {
    let asking = makeAsking()

    await asking.ask("a", when: true) { Answer(id: 1, ready: true) }

    XCTAssertNil(asking.answer(for: "b"))
    XCTAssertEqual(asking.last(for: "b")?.id, 1)
  }

  func testShowsNoAnswerWhileTheChoiceShownIsAnsweredUnready() async {
    let asking = makeAsking(patience: .zero)

    await asking.ask("a", when: true) { Answer(id: 1, ready: true) }
    await asking.ask("b", when: true) { Answer(id: 2, ready: false) }

    XCTAssertNil(asking.last(for: "b"))
    XCTAssertNil(asking.last(for: "c"))
    XCTAssertEqual(asking.last(for: "a")?.id, 1)
  }

  func testGivesUpAfterThreeFailuresInARowUntilRestarted() async {
    let asking = makeAsking()
    let replies = Replies([.failure(Unavailable())])

    await asking.ask("week", when: true) { try replies.next() }

    XCTAssertEqual(replies.calls, 3)
    XCTAssertEqual(asking.status, .failed)

    asking.restart()

    XCTAssertEqual(asking.round, 1)
  }

  func testAnAnswerBetweenFailuresStartsTheCountAgain() async {
    let asking = makeAsking()
    let replies = Replies([
      .failure(Unavailable()), .failure(Unavailable()), .success(Answer(id: 1, ready: false)),
      .failure(Unavailable()), .failure(Unavailable()), .success(Answer(id: 2, ready: true)),
    ])

    await asking.ask("week", when: true) { try replies.next() }

    XCTAssertEqual(replies.calls, 6)
    XCTAssertEqual(asking.answer(for: "week")?.id, 2)
  }

  func testGivesUpOnAPlanThatStaysUnready() async {
    let asking = makeAsking(patience: .milliseconds(20))

    await asking.ask("week", when: true) { Answer(id: 1, ready: false) }

    XCTAssertEqual(asking.status, .failed)
    XCTAssertNil(asking.answer(for: "week"))
  }

  func testAsksNothingWhenThereIsNothingToAsk() async {
    let asking = makeAsking()
    let replies = Replies([.success(Answer(id: 1, ready: true))])

    await asking.ask("week", when: false) { try replies.next() }

    XCTAssertEqual(replies.calls, 0)
    XCTAssertEqual(asking.status, .idle)
  }

  func testDropsAnAnswerThatComesAfterTheChoiceChanged() async {
    let asking = makeAsking()

    let task = Task {
      await asking.ask("old", when: true) {
        try? await Task.sleep(for: .seconds(30))
        return Answer(id: 1, ready: true)
      }
    }

    task.cancel()
    await task.value

    XCTAssertNil(asking.answer(for: "old"))
    XCTAssertNil(asking.first)
    XCTAssertNotEqual(asking.status, .failed)
  }
}
