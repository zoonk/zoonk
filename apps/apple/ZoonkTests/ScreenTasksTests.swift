import XCTest

@testable import Zoonk

/// A step's request can answer after the learner left it (Back during the last answer); what it
/// leads to then must not happen, so setup doesn't move from where the learner went.
@MainActor
final class ScreenTasksTests: XCTestCase {
  func testALateAnswerAfterTheStepLeftGoesNowhere() async {
    let tasks = ScreenTasks()
    let (response, answer) = AsyncStream<Void>.makeStream()
    let ended = expectation(description: "the step's work ended")
    var wentOn = false

    tasks.run {
      // The write finishes even for a caller that's gone, as the app's writes do.
      await Task {
        for await _ in response { break }
      }.value

      try? await goOnUnlessLeft { wentOn = true }
      ended.fulfill()
    }

    tasks.cancel()
    answer.yield()
    answer.finish()
    await fulfillment(of: [ended], timeout: 5)

    XCTAssertFalse(wentOn, "the step that left doesn't finish setup")
  }

  /// Back while a goal is created: the server keeps the goal (the next visit finds it), and the
  /// visit that left opens nothing.
  func testAGoalCreatedAfterTheVisitLeftIsKeptAndOpensNothing() async {
    let tasks = ScreenTasks()
    let (response, answer) = AsyncStream<Void>.makeStream()
    let ended = expectation(description: "the visit's work ended")
    var saved = false
    var opened: String?

    tasks.send {
      for await _ in response { break }
      saved = true
      return "goal"
    } then: { goalID in
      opened = goalID
    } ended: {
      ended.fulfill()
    }

    tasks.cancel()
    answer.yield()
    answer.finish()
    await fulfillment(of: [ended], timeout: 5)

    XCTAssertTrue(saved, "the write the tap sent finishes")
    XCTAssertNil(opened, "the visit that left opens nothing")
  }

  /// The old visit's late answer opens nothing, and canceling it leaves the new visit's alone.
  func testANewVisitIsNotCanceledByTheOldVisit() async {
    let old = ScreenTasks()
    let current = ScreenTasks()
    let (response, answer) = AsyncStream<Void>.makeStream()
    let ended = expectation(description: "both visits' work ended")
    ended.expectedFulfillmentCount = 2
    var wentOn: [String] = []

    for (owner, name) in [(old, "old"), (current, "current")] {
      owner.run {
        await Task {
          for await _ in response { break }
        }.value

        try? await goOnUnlessLeft { wentOn.append(name) }
        ended.fulfill()
      }
    }

    old.cancel()
    answer.yield()
    answer.finish()
    await fulfillment(of: [ended], timeout: 5)

    XCTAssertEqual(wentOn, ["current"])
  }

  func testAnAnswerWhileTheStepShowsGoesOn() async {
    let tasks = ScreenTasks()
    let ended = expectation(description: "the step's work ended")
    var wentOn = false

    tasks.run {
      try? await goOnUnlessLeft { wentOn = true }
      ended.fulfill()
    }

    await fulfillment(of: [ended], timeout: 5)

    XCTAssertTrue(wentOn)
  }
}
