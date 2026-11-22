import XCTest

@testable import Zoonk

@MainActor
final class VisitRequestTests: XCTestCase {
  func testWorkThatLandsAfterLeavingShowsNothingAndOpensNothing() async {
    let request = VisitRequest<String>()
    let answer = TestGate()
    let ended = TestGate()
    var followed: [String?] = []

    request.run(
      {
        await answer.wait()
        ended.open()
        return "failed"
      }, then: { followed.append($0) })
    XCTAssertTrue(request.isRunning)

    request.leave()
    answer.open()
    await ended.wait()

    XCTAssertNil(request.outcome)
    XCTAssertFalse(request.isRunning)
    XCTAssertEqual(followed, [])
  }

  func testASecondRunReplacesTheFirstSoOnlyTheNewerResultLands() async {
    let request = VisitRequest<String>()
    let firstAnswer = TestGate()
    let firstEnded = TestGate()
    let secondAnswer = TestGate()
    let secondFollowed = TestGate()
    var followed: [String?] = []

    request.run(
      {
        await firstAnswer.wait()
        firstEnded.open()
        return "first"
      }, then: { followed.append($0) })
    request.run(
      {
        await secondAnswer.wait()
        return "second"
      },
      then: {
        followed.append($0)
        secondFollowed.open()
      })

    secondAnswer.open()
    await secondFollowed.wait()
    firstAnswer.open()
    await firstEnded.wait()

    XCTAssertEqual(request.outcome, "second")
    XCTAssertFalse(request.isRunning)
    XCTAssertEqual(followed, ["second"])
  }

  func testLeavingClearsAFinishedRunsOutcome() async {
    let request = VisitRequest<String>()
    let followed = TestGate()

    request.run({ "failed" }, then: { _ in followed.open() })
    await followed.wait()
    XCTAssertEqual(request.outcome, "failed")

    request.leave()

    XCTAssertNil(request.outcome)
    XCTAssertFalse(request.isRunning)
  }
}
