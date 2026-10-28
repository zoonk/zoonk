import XCTest

@testable import Zoonk

final class GenerationWaitTests: XCTestCase {
  func testShowsTheExamDatesStepOnlyOnceTheRunReportsIt() {
    var wait = GenerationWait(kind: .understanding)

    XCTAssertEqual(wait.visiblePhases.map(\.id), ["read"])

    wait.apply(GenerationEvent(status: "started", step: "readGoal"))
    wait.apply(GenerationEvent(status: "started", step: "findExamDates"))

    XCTAssertEqual(wait.visiblePhases.map(\.id), ["read", "dates"])
    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .working])
    XCTAssertFalse(wait.isDone)

    wait.apply(GenerationEvent(status: "completed", step: "understandingReady"))

    XCTAssertTrue(wait.isDone)
  }

  func testFollowsTheRunAlreadyReadingTheSameWords() {
    var wait = GenerationWait(kind: .understanding)

    wait.apply(
      GenerationEvent(entityID: "run-2", status: "started", step: "joinRunningUnderstanding"))

    XCTAssertEqual(wait.joinedGenerationID, "run-2")
  }

  func testAPlanIsReadyOnceItIsSavedWhileOutlinesGoOn() {
    var wait = GenerationWait(kind: .curriculum)

    wait.apply(GenerationEvent(status: "completed", step: "buildSkillGraph"))
    wait.apply(GenerationEvent(status: "started", step: "createPlan"))

    XCTAssertFalse(wait.isDone)
    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .working])

    wait.apply(GenerationEvent(status: "completed", step: "createPlan"))

    XCTAssertTrue(wait.isDone)
  }

  func testAnExplanationCanBeReadOnceItIsWritten() {
    var wait = GenerationWait(kind: .explanation)

    wait.apply(GenerationEvent(status: "completed", step: "findExplanation"))

    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .waiting])
    XCTAssertFalse(wait.isDone)

    wait.apply(GenerationEvent(status: "completed", step: "writeExplanation"))

    XCTAssertTrue(wait.isDone)
  }

  func testTheFirstPhaseGoesBeforeAnyEvent() {
    XCTAssertEqual(
      GenerationWait(kind: .curriculum).started.visiblePhases.map(\.state),
      [.working, .waiting, .waiting])
  }

  func testIgnoresStepsItDoesntKnow() {
    var wait = GenerationWait(kind: .curriculum)

    wait.apply(GenerationEvent(status: "started", step: "somethingNew"))

    XCTAssertEqual(wait, GenerationWait(kind: .curriculum))
  }
}
