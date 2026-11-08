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

    XCTAssertEqual(
      wait.visiblePhases.map(\.state), [.done, .done, .working],
      "a finished stage starts the next, as main's wait does")
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

  func testEachPhasesClockRunsOnFromTheOneBeforeInTheServersTime() {
    let start = Date(timeIntervalSince1970: 1_000)
    var wait = GenerationWait(kind: .lesson).started

    // The device's clock runs 30 seconds ahead; a replayed event arrives late, so the smallest gap
    // is the clocks' difference.
    wait.apply(
      GenerationEvent(at: start, status: "started", step: "planLesson"),
      receivedAt: start.addingTimeInterval(90))
    wait.apply(
      GenerationEvent(at: start.addingTimeInterval(52), status: "completed", step: "planLesson"),
      receivedAt: start.addingTimeInterval(82))
    wait.apply(
      GenerationEvent(at: start.addingTimeInterval(55), status: "started", step: "writeLesson"),
      receivedAt: start.addingTimeInterval(85))

    let plan = wait.visiblePhases[0]
    let write = wait.visiblePhases[1]
    XCTAssertEqual(plan.endedAt?.timeIntervalSince(plan.startedAt ?? .distantPast), 52)
    XCTAssertEqual(
      write.startedAt, start.addingTimeInterval(52), "writing's clock starts as planning ends")
    XCTAssertEqual(wait.clockOffset, 30)
  }

  func testTheBarWeighsEachPhaseByItsUsualTime() {
    var wait = GenerationWait(kind: .lesson).started

    wait.apply(GenerationEvent(status: "completed", step: "planLesson"))

    let progress = wait.progress
    XCTAssertEqual(progress.share, 40.0 / 145, accuracy: 0.001)
    XCTAssertEqual(progress.target, 90.0 / 145, accuracy: 0.001, "up to the end of writing")
    XCTAssertEqual(progress.runningSeconds, 50)

    wait.apply(GenerationEvent(status: "completed", step: "lessonReady"))

    XCTAssertEqual(wait.progress.share, 1)
    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .done, .done])
  }

  func testWritingALessonCountsItsScreensWithAChecksBetweenThenKeepsChecking() {
    let write = GenerationWait(kind: .lesson).phases[1]
    let lines = (0..<10).map { write.detailLine(tick: $0).map { String(localized: $0) } }

    XCTAssertEqual(
      lines,
      [
        "Writing screen 1…", "Writing screen 2…", "Checking the answers…", "Writing screen 3…",
        "Writing screen 4…", "Checking the answers…", "Writing screen 5…", "Writing screen 6…",
        "Checking the answers…", "Checking the answers…",
      ])
  }

  func testLessonOneIsReadyOnceTheRunOrTheReadSaysSo() {
    var wait = GenerationWait(kind: .curriculum)
    let writing = GenerationEvent(
      lessonID: "lesson", lessonTitle: "Why birds sing at dawn", status: "started",
      step: "writeFirstLesson")

    wait.apply(writing)
    XCTAssertEqual(wait.firstLesson?.isReady, false)

    let ready = GenerationWait.FirstLesson(
      id: "lesson", title: "Why birds sing at dawn", isReady: true)
    XCTAssertEqual(wait.firstLesson(read: ready)?.isReady, true)

    wait.apply(GenerationEvent(lessonID: "lesson", status: "completed", step: "firstLessonReady"))
    // A reconnection replays the lesson being picked after it was ready.
    wait.apply(writing)
    XCTAssertEqual(wait.firstLesson?.isReady, true)
    XCTAssertEqual(wait.firstLesson(read: ready)?.isDone, false)

    // Finished, as only the read knows: the stream's replayed ready never offers it again.
    var done = ready
    done.isDone = true
    XCTAssertEqual(wait.firstLesson(read: done)?.isDone, true)
  }

  /// A wait opened two minutes into its stage goes on from there: its steps come replayed at once,
  /// then a live one tells the two clocks apart.
  func testAWaitOpenedPartwayDriftsFromWhenItsStageStarted() {
    let opened = Date()
    var wait = GenerationWait(kind: .curriculum, since: opened).started

    for event in [
      GenerationEvent(
        at: opened.addingTimeInterval(-130), status: "completed", step: "understandGoal"),
      GenerationEvent(
        at: opened.addingTimeInterval(-120), status: "started", step: "buildSkillGraph"),
      GenerationEvent(
        at: opened, skillName: "Telling songs from calls", status: "started",
        step: "buildSkillGraph"),
    ] {
      wait.apply(event, receivedAt: opened)
    }

    XCTAssertGreaterThan(wait.shownShare(at: opened), wait.progress.share + 0.1)
  }

  func testIgnoresStepsItDoesntKnow() {
    let fresh = GenerationWait(kind: .curriculum)
    var wait = fresh

    wait.apply(GenerationEvent(status: "started", step: "somethingNew"))

    XCTAssertEqual(wait, fresh)
  }
}
