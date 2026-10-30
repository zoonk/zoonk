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

  /// Holds each request until it's released, recording what was asked.
  private final class HeldRequests {
    private(set) var asked: [String] = []
    private var held: [CheckedContinuation<Answer, Never>] = []
    private var waiters: [(count: Int, resume: CheckedContinuation<Void, Never>)] = []

    func answer(_ key: String, id: Int) async -> Answer {
      asked.append(key)
      for waiter in waiters where waiter.count <= asked.count {
        waiter.resume.resume()
      }

      waiters.removeAll { $0.count <= asked.count }
      return await withCheckedContinuation { held.append($0) }
    }

    func waitForAsks(_ count: Int) async {
      guard asked.count < count else {
        return
      }

      await withCheckedContinuation { waiters.append((count, $0)) }
    }

    func releaseNext(ready: Bool = true) {
      held.removeFirst().resume(returning: Answer(id: asked.count, ready: ready))
    }
  }

  private func makeAsking(
    patience: Duration = .seconds(60), timeout: Duration = .seconds(60)
  ) -> PlanAsking<String, Answer> {
    PlanAsking(
      interval: .milliseconds(1), settle: .milliseconds(1), patience: patience, timeout: timeout)
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

  func testDaysChangedDuringASearchAskOnceForTheLatestWeek() async {
    let asking = makeAsking()
    let server = HeldRequests()

    let first = Task { await asking.ask("a", when: true) { await server.answer("a", id: 1) } }
    await server.waitForAsks(1)

    let second = Task { await asking.ask("b", when: true) { await server.answer("b", id: 2) } }
    first.cancel()
    await Task.yield()
    let latest = Task { await asking.ask("c", when: true) { await server.answer("c", id: 3) } }
    second.cancel()

    server.releaseNext()
    await server.waitForAsks(2)
    server.releaseNext()
    await latest.value

    XCTAssertEqual(server.asked, ["a", "c"])
    XCTAssertEqual(asking.answer(for: "c")?.ready, true)
  }

  func testASearchUnansweredTooLongFailsWithoutSendingItAgain() async {
    let asking = makeAsking(timeout: .milliseconds(20))
    let server = HeldRequests()

    await asking.ask("a", when: true) { await server.answer("a", id: 1) }

    XCTAssertEqual(asking.status, .failed)
    XCTAssertEqual(server.asked, ["a"], "asking again joins the request still out")

    server.releaseNext()
  }

  func testAWeekWaitingForTheLaneFailsInTimeWithoutBeingSent() async {
    let asking = makeAsking(timeout: .milliseconds(20))
    let server = HeldRequests()

    let first = Task { await asking.ask("a", when: true) { await server.answer("a", id: 1) } }
    await server.waitForAsks(1)
    first.cancel()

    await asking.ask("b", when: true) { await server.answer("b", id: 2) }

    XCTAssertEqual(asking.status, .failed)
    XCTAssertEqual(server.asked, ["a"], "the latest week waits for the one still out")

    server.releaseNext()
  }
}
