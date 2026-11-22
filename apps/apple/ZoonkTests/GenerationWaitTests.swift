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

  func testAHeldBackChallengeKeepsFixingUntilItIsReady() {
    var wait = GenerationWait(kind: .challenge)

    XCTAssertEqual(wait.visiblePhases.map(\.id), ["plan", "write"])

    for (status, step) in [
      ("completed", "planChallenge"), ("completed", "writeChallenge"),
      ("completed", "reviewChallenge"), ("started", "fixChallenge"),
    ] {
      wait.apply(GenerationEvent(status: status, step: step))
    }

    let run = FollowedRun(
      wait: wait, failure: nil, warmUpID: nil, isRestarting: false, retry: nil)
    XCTAssertEqual(wait.visiblePhases.map(\.id), ["plan", "write", "fix"])
    XCTAssertEqual(wait.visiblePhases.map(\.state), [.done, .done, .working])
    XCTAssertEqual(run.workingLabel, "Fixing what the check found")
    XCTAssertEqual(wait.progress.share, 125.0 / 150.0, accuracy: 0.0001)

    for (status, step) in [
      ("completed", "fixChallenge"), ("started", "recheckChallenge"),
      ("completed", "recheckChallenge"),
    ] {
      wait.apply(GenerationEvent(status: status, step: step))
    }

    XCTAssertEqual(
      wait.visiblePhases.map(\.state), [.done, .done, .working],
      "the fix keeps working until the challenge is ready")
    XCTAssertFalse(wait.isDone)

    wait.apply(GenerationEvent(status: "completed", step: "lessonReady"))

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

  func testIgnoresStepsItDoesntKnow() {
    let fresh = GenerationWait(kind: .curriculum)
    var wait = fresh

    wait.apply(GenerationEvent(status: "started", step: "somethingNew"))

    XCTAssertEqual(wait, fresh)
  }
  func testStoppedLessonOutranksReplayedWriting() {
    var wait = GenerationWait(kind: .curriculum)
    wait.apply(
      GenerationEvent(
        lessonID: "lesson", lessonTitle: "Dawn", status: "started", step: "writeFirstLesson"))
    let stopped = GenerationWait.FirstLesson(
      .init(id: "lesson", status: .stopped, title: "Dawn"))
    XCTAssertEqual(wait.firstLesson(read: stopped)?.isStopped, true)
    XCTAssertEqual(wait.firstLesson(read: stopped)?.isReady, false)
  }

  func testReadyFromEitherSourceOutranksStoppedAndANewerReadRecoversWriting() {
    var wait = GenerationWait(kind: .curriculum)
    wait.apply(
      GenerationEvent(
        lessonID: "lesson", lessonTitle: "Dawn", status: "started", step: "writeFirstLesson"))
    let stopped = GenerationWait.FirstLesson(.init(id: "lesson", status: .stopped, title: "Dawn"))
    XCTAssertEqual(wait.firstLesson(read: stopped)?.isStopped, true)
    let writing = GenerationWait.FirstLesson(.init(id: "lesson", status: .writing, title: "Dawn"))
    XCTAssertEqual(wait.firstLesson(read: writing)?.isStopped, false)
    wait.apply(GenerationEvent(lessonID: "lesson", status: "completed", step: "firstLessonReady"))
    XCTAssertEqual(wait.firstLesson(read: stopped)?.isReady, true)
    XCTAssertEqual(wait.firstLesson(read: stopped)?.isStopped, false)
  }

  func testANewRunResetsThePreviousRunsStoppedRead() {
    var wait = GenerationWait(kind: .curriculum)
    wait.apply(
      GenerationEvent(
        lessonID: "lesson", lessonTitle: "Dawn", status: "started", step: "writeFirstLesson"))
    let read = GenerationWait.FirstLesson(.init(id: "lesson", status: .stopped, title: "Dawn"))
    XCTAssertEqual(
      wait.firstLesson(read: read, readGenerationID: "old", generationID: "old")?.isStopped, true)
    XCTAssertEqual(
      wait.firstLesson(read: read, readGenerationID: "old", generationID: "new")?.isStopped, false)
    XCTAssertEqual(
      wait.firstLesson(read: read, readGenerationID: "new", generationID: "new")?.isStopped, true)
  }
}
