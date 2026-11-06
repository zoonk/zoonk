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

  func testAPlanIsReadyOnceItIsSavedWhileOutlinesGoOn() {
    var wait = GenerationWait(kind: .curriculum)

    wait.apply(GenerationEvent(status: "completed", step: "buildSkillGraph"))
    wait.apply(GenerationEvent(status: "started", step: "createPlan"))

    XCTAssertFalse(wait.isDone)
    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .working])

    wait.apply(GenerationEvent(status: "completed", step: "createPlan"))

    XCTAssertTrue(wait.isDone)
  }

  func testTheSkillsStepKeepsTheNewestSkillTheGraphWrote() {
    var wait = GenerationWait(kind: .curriculum)

    wait.apply(GenerationEvent(status: "started", step: "buildSkillGraph"))
    wait.apply(GenerationEvent(skillName: "Variables", status: "started", step: "buildSkillGraph"))
    wait.apply(GenerationEvent(skillName: "Loops", status: "started", step: "buildSkillGraph"))
    wait.apply(GenerationEvent(status: "started", step: "buildSkillGraph"))

    let skills = wait.visiblePhases.first { $0.id == "skills" }
    XCTAssertEqual(skills?.skillName, "Loops")
    XCTAssertEqual(skills?.state, .working)
  }

  func testAnExplanationCanBeReadOnceItIsWritten() {
    var wait = GenerationWait(kind: .explanation)

    wait.apply(GenerationEvent(status: "completed", step: "findExplanation"))

    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .waiting])
    XCTAssertFalse(wait.isDone)

    wait.apply(GenerationEvent(status: "completed", step: "writeExplanation"))

    XCTAssertTrue(wait.isDone)
  }

  func testALessonsMarksAndPicturesEachFinishOnTheirOwnStepInEitherOrder() {
    for (first, second) in [("markLesson", "drawPictures"), ("drawPictures", "markLesson")] {
      var wait = GenerationWait(kind: .lesson)
      wait.apply(GenerationEvent(status: "completed", step: "writeLesson"))
      wait.apply(GenerationEvent(status: "started", step: first))

      XCTAssertEqual(
        wait.visiblePhases.map(\.state), [.done, .done, .working, .working],
        "\(first) starting starts the step beside it too")

      wait.apply(GenerationEvent(status: "started", step: second))
      wait.apply(GenerationEvent(status: "completed", step: first))

      let (done, running) = first == "markLesson" ? (2, 3) : (3, 2)
      XCTAssertEqual(wait.visiblePhases[done].state, .done)
      XCTAssertEqual(wait.visiblePhases[running].state, .working, "\(second) is still running")
      XCTAssertFalse(wait.isDone)

      wait.apply(GenerationEvent(status: "completed", step: second))

      XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .done, .done])
      XCTAssertFalse(wait.isDone, "the lesson opens on lessonReady, after both")

      wait.apply(GenerationEvent(status: "completed", step: "lessonReady"))

      XCTAssertTrue(wait.isDone)
    }
  }

  func testIgnoresStepsItDoesntKnow() {
    var wait = GenerationWait(kind: .curriculum)

    wait.apply(GenerationEvent(status: "started", step: "somethingNew"))

    XCTAssertEqual(wait, GenerationWait(kind: .curriculum))
  }
}
