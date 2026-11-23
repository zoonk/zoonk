import Synchronization
import XCTest

@testable import Zoonk

@MainActor
final class PlanAskingTests: XCTestCase {
  private struct Answer: PlanAnswer {
    let id: Int
    let ready: Bool
    var readingNotice = false
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
    private var held: [TestContinuation<Answer>] = []
    private var waiters: [(count: Int, resume: TestContinuation<Void>)] = []

    func answer(_ key: String, id: Int) async throws -> Answer {
      asked.append(key)
      for waiter in waiters where waiter.count <= asked.count {
        waiter.resume.resume()
      }

      waiters.removeAll { $0.count <= asked.count }
      return try await withTestContinuation { held.append($0) }
    }

    func waitForAsks(_ count: Int, file: StaticString = #filePath, line: UInt = #line) async {
      guard asked.count < count else {
        return
      }

      await withTestVoidContinuation(file: file, line: line) { waiters.append((count, $0)) }
    }

    func releaseNext() {
      held.removeFirst().resume(returning: Answer(id: asked.count, ready: true))
    }
  }

  /// Sleeps of at most `step` pass at once and move its time on; a longer one, a request's timeout,
  /// waits until it's cancelled.
  private final class StepClock: Clock {
    struct Instant: InstantProtocol {
      let offset: Duration

      func advanced(by duration: Duration) -> Instant { Instant(offset: offset + duration) }
      func duration(to other: Instant) -> Duration { other.offset - offset }
      static func < (lhs: Instant, rhs: Instant) -> Bool { lhs.offset < rhs.offset }
    }

    private let current = Mutex(Instant(offset: .zero))
    private let step: Duration
    private let expireFirstTimeout: Mutex<Bool>
    private let onInterval: @Sendable () async throws -> Void

    init(
      step: Duration, expireFirstTimeout: Bool = false,
      onInterval: @escaping @Sendable () async throws -> Void = {}
    ) {
      self.onInterval = onInterval
      self.step = step
      self.expireFirstTimeout = Mutex(expireFirstTimeout)
    }

    var now: Instant { current.withLock { $0 } }
    var minimumResolution: Duration { .zero }

    func sleep(until deadline: Instant, tolerance: Duration?) async throws {
      if now.duration(to: deadline) > step {
        let expires = expireFirstTimeout.withLock { expires in
          defer { expires = false }
          return expires
        }
        if !expires {
          try await waitForCancellation()
          return
        }
      } else {
        try await onInterval()
      }

      current.withLock { $0 = max($0, deadline) }
      await Task.yield()
      try Task.checkCancellation()
    }
  }

  private func makeAsking(timeout: Duration = .seconds(60))
    -> PlanAsking<String, Answer, ContinuousClock>
  {
    PlanAsking(interval: .milliseconds(1), settle: .milliseconds(1), timeout: timeout)
  }

  /// A language goal's date answers one aim: another aim's line never shows it while its own asks.
  func testTheLastAnswerStandsInOnlyForAKeyLikeIts() async {
    let asking = makeAsking()

    await asking.ask("B1 15 min", when: true) { Answer(id: 1, ready: true) }

    XCTAssertEqual(asking.last(for: "B1 20 min") { $0.hasPrefix("B1") }?.id, 1)
    XCTAssertNil(asking.last(for: "B2 15 min") { $0.hasPrefix("B2") })
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
    let asking = makeAsking()

    await asking.ask("a", when: true) { Answer(id: 1, ready: true) }

    let unready = Task { await asking.ask("b", when: true) { Answer(id: 2, ready: false) } }
    _ = try? await waitForTestCondition("Fixture state did not arrive") {
      !(asking.answers["b"] == nil)
    }
    unready.cancel()
    await unready.value

    XCTAssertNil(asking.last(for: "b"))
    XCTAssertNil(asking.last(for: "c"))
    XCTAssertEqual(asking.last(for: "a")?.id, 1)
  }

  func testTellsThePlansReadinessFromTheLastAnswerReadyOrNot() async {
    let asking = makeAsking()

    XCTAssertNil(asking.readiness(for: "a"))

    await asking.ask("a", when: true) { Answer(id: 1, ready: true) }

    let unready = Task {
      await asking.ask("b", when: true) { Answer(id: 2, ready: false, readingNotice: true) }
    }
    _ = try? await waitForTestCondition("Fixture state did not arrive") {
      !(asking.answers["b"] == nil)
    }
    unready.cancel()
    await unready.value

    XCTAssertEqual(asking.readiness(for: "a"), PlanReadiness(ready: true, readingNotice: false))
    XCTAssertEqual(asking.readiness(for: "c"), PlanReadiness(ready: false, readingNotice: true))
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

  func testKeepsAskingPastTenMinutesWhileThePlanStaysUnready() async {
    let clock = StepClock(step: .seconds(3))
    let asking = PlanAsking<String, Answer, StepClock>(
      clock: clock, interval: .seconds(3), settle: .milliseconds(300), timeout: .seconds(45))
    let unready = 250
    let replies = Replies(
      Array(repeating: .success(Answer(id: 1, ready: false)), count: unready) + [
        .success(Answer(id: 2, ready: true))
      ])

    await asking.ask("week", when: true) { try replies.next() }

    XCTAssertGreaterThan(clock.now.offset, .seconds(600))
    XCTAssertEqual(replies.calls, unready + 1)
    XCTAssertEqual(asking.answer(for: "week")?.id, 2)
    XCTAssertEqual(asking.status, .idle)
  }

  func testAsksNothingWhenThereIsNothingToAsk() async {
    let asking = makeAsking()
    let replies = Replies([.success(Answer(id: 1, ready: true))])

    await asking.ask("week", when: false) { try replies.next() }

    XCTAssertEqual(replies.calls, 0)
    XCTAssertEqual(asking.status, .idle)
  }

  func testDropsAnAnswerThatComesAfterTheChoiceChanged() async throws {
    let asking = makeAsking()
    let server = HeldRequests()
    var requestFinished = false
    let task = Task {
      await asking.ask("old", when: true) {
        defer { requestFinished = true }
        return try await server.answer("old", id: 1)
      }
    }
    await server.waitForAsks(1)
    task.cancel()
    await task.value
    server.releaseNext()
    try await waitForTestCondition("The canceled visit's request did not finish") {
      requestFinished
    }

    XCTAssertNil(asking.answer(for: "old"))
    XCTAssertNil(asking.first)
    XCTAssertNotEqual(asking.status, .failed)
  }

  func testDaysChangedDuringASearchAskOnceForTheLatestWeek() async {
    let asking = makeAsking()
    let server = HeldRequests()

    let first = Task { await asking.ask("a", when: true) { try await server.answer("a", id: 1) } }
    await server.waitForAsks(1)

    let second = Task { await asking.ask("b", when: true) { try await server.answer("b", id: 2) } }
    first.cancel()
    await Task.yield()
    let latest = Task { await asking.ask("c", when: true) { try await server.answer("c", id: 3) } }
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

    await asking.ask("a", when: true) { try await server.answer("a", id: 1) }

    XCTAssertEqual(asking.status, .failed)
    XCTAssertEqual(server.asked, ["a"], "asking again joins the request still out")

    server.releaseNext()
  }

  func testAnAnswerAfterATimeoutClearsTheFailureWhileItKeepsAsking() async {
    @MainActor final class Asks {
      var firstReturned = false
      var count = 0
      var statusOnRetry: PlanAsking<String, Answer, StepClock>.Status?
    }

    let asks = Asks()
    let clock = StepClock(step: .seconds(3), expireFirstTimeout: true) {
      try await waitForTestCondition("The first answer did not arrive between asks") {
        asks.firstReturned
      }
    }
    let asking = PlanAsking<String, Answer, StepClock>(
      clock: clock,
      interval: .seconds(3), settle: .milliseconds(300), timeout: .seconds(45))

    await asking.ask("a", when: true) {
      asks.count += 1

      guard asks.count > 1 else {
        try await waitForTestCondition("The first ask did not time out") {
          asking.status == .failed
        }
        asks.firstReturned = true
        return Answer(id: 1, ready: false)
      }

      asks.statusOnRetry = asking.status
      return Answer(id: 2, ready: true)
    }

    XCTAssertEqual(asks.count, 2)
    XCTAssertEqual(asks.statusOnRetry, .asking)
    XCTAssertEqual(asking.status, .idle)
  }

  func testAWeekWaitingForTheLaneFailsInTimeWithoutBeingSent() async {
    let asking = makeAsking(timeout: .milliseconds(20))
    let server = HeldRequests()

    let first = Task { await asking.ask("a", when: true) { try await server.answer("a", id: 1) } }
    await server.waitForAsks(1)
    first.cancel()

    await asking.ask("b", when: true) { try await server.answer("b", id: 2) }

    XCTAssertEqual(asking.status, .failed)
    XCTAssertEqual(server.asked, ["a"], "the latest week waits for the one still out")

    server.releaseNext()
  }
}

private func waitForCancellation() async throws {
  try await waitForTestCondition("The fixture sleep was never canceled") { Task.isCancelled }
  throw CancellationError()
}
