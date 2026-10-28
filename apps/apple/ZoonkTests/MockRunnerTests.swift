import XCTest

@testable import Zoonk

final class MockSectionMovesTests: XCTestCase {
  private let forwardOnly = MockSection.Navigation(
    answerChanges: 2, forwardOnly: true, itemSeconds: 90, mustAnswer: false)

  func testAFreeSectionOpensAnyQuestion() {
    let moves = MockSectionMoves(
      answered: false, changed: [], changesLeft: nil, navigation: nil, position: 0, reached: 0,
      total: 5)

    XCTAssertTrue(moves.canOpen(4))
    XCTAssertTrue(moves.canOpen(0))
    XCTAssertFalse(moves.canOpen(5), "No question past the section")
    XCTAssertTrue(moves.canChange(2))
    XCTAssertNil(moves.itemSeconds)
  }

  func testAForwardOnlySectionOpensOnlyTheNextQuestionAndKeepsEarlierAnswers() {
    let moves = MockSectionMoves(
      answered: true, changed: [], changesLeft: 2, navigation: forwardOnly, position: 2,
      reached: 2, total: 5)

    XCTAssertTrue(moves.canOpen(3))
    XCTAssertFalse(moves.canOpen(1), "An earlier question stays behind")
    XCTAssertFalse(moves.canOpen(4), "Only the next one")
    XCTAssertFalse(moves.canChange(1))
    XCTAssertFalse(moves.reviewing)
    XCTAssertEqual(moves.itemSeconds, 90)
  }

  func testItsReviewOpensEveryQuestionAndCountsTheChangesLeft() {
    let moves = MockSectionMoves(
      answered: true, changed: [1], changesLeft: 2, navigation: forwardOnly, position: 4,
      reached: 4, total: 5)

    XCTAssertTrue(moves.reviewing)
    XCTAssertTrue(moves.canOpen(0))
    XCTAssertEqual(moves.changesLeft, 1, "One of the two changes is used")
    XCTAssertTrue(moves.canChange(1), "A changed answer changes again for free")
    XCTAssertTrue(moves.canChange(0))
    XCTAssertNil(moves.itemSeconds, "The review has no question clock")
  }

  func testTheReviewRefusesChangesOnceTheyAreUsed() {
    let moves = MockSectionMoves(
      answered: true, changed: [0, 1], changesLeft: 2, navigation: forwardOnly, position: 4,
      reached: 4, total: 5)

    XCTAssertEqual(moves.changesLeft, 0)
    XCTAssertFalse(moves.canChange(2))
    XCTAssertTrue(moves.canChange(1))
  }

  func testMustAnswerWaitsForAnAnswerButATimeOutMovesOn() {
    let navigation = MockSection.Navigation(
      answerChanges: nil, forwardOnly: true, itemSeconds: 60, mustAnswer: true)
    let moves = MockSectionMoves(
      answered: false, changed: [], changesLeft: nil, navigation: navigation, position: 0,
      reached: 0, total: 3)

    XCTAssertFalse(moves.canAdvance)
    XCTAssertFalse(moves.canOpen(1))
    XCTAssertTrue(moves.canOpenAfterTimeout(1))
    XCTAssertFalse(moves.canOpenAfterTimeout(2))
  }
}

@MainActor
final class MockDraftQueueTests: XCTestCase {
  private func draft(_ itemId: String, _ answer: PracticeAnswer?) -> MockDraft {
    MockDraft(answer: answer, durationMs: 0, flagged: false, itemId: itemId)
  }

  func testAnswersGoOutInOrderAndANewerOneReplacesOneStillWaiting() async {
    let sent = Recorder()
    let gate = Gate()
    let queue = MockDraftQueue { draft in
      await gate.wait()
      sent.items.append(draft)
      return .stored
    }

    queue.add(draft("a", .choice(0)))
    queue.add(draft("b", .choice(1)))
    queue.add(draft("b", .choice(2)))
    gate.open()
    await queue.idle()

    XCTAssertEqual(sent.items.map(\.itemId), ["a", "b"])
    XCTAssertEqual(sent.items.last?.answer, .choice(2), "The newest answer to b went out")
    XCTAssertEqual(queue.status, .saved)
  }

  func testAnAnswerThatDidNotGetThroughGoesAgainBeforeTheNextOne() async {
    let sent = Recorder()
    var failures = 1
    let queue = MockDraftQueue(
      retryDelay: { _ in .milliseconds(10) },
      save: { draft in
        if failures > 0 {
          failures -= 1
          return .unreachable
        }

        sent.items.append(draft)
        return .stored
      })

    queue.add(draft("a", .choice(0)))
    queue.add(draft("b", .choice(1)))
    await queue.idle()

    XCTAssertEqual(sent.items.map(\.itemId), ["a", "b"])
    XCTAssertEqual(queue.status, .saved)
  }

  func testARefusedAnswerSaysSoUntilALaterOneIsStored() async {
    var refuse = true
    let queue = MockDraftQueue { _ in refuse ? .refused : .stored }

    queue.add(draft("a", .choice(0)))
    await queue.idle()
    XCTAssertEqual(queue.status, .refused)

    refuse = false
    queue.add(draft("b", .choice(1)))
    await queue.idle()
    XCTAssertEqual(queue.status, .saved)
  }

  func testABlankDraftIsNotAnswered() {
    XCTAssertFalse(draft("a", nil).isAnswered)
    XCTAssertFalse(draft("a", .text("  \n")).isAnswered)
    XCTAssertFalse(draft("a", .dontKnow).isAnswered, "Leave blank is a blank")
    XCTAssertTrue(draft("a", .number(0)).isAnswered)
    XCTAssertTrue(draft("a", .choice(0)).isAnswered)
  }
}

@MainActor
private final class Recorder {
  var items: [MockDraft] = []
}

@MainActor
private final class Gate {
  private var isOpen = false

  func open() { isOpen = true }

  func wait() async {
    while !isOpen {
      try? await Task.sleep(for: .milliseconds(5))
    }
  }
}
