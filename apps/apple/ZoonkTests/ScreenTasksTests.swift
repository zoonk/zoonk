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
