import XCTest

@testable import Zoonk

final class PhaseEndTests: XCTestCase {
  func testALearningPhaseEndsOnAnEstimateWhileItsChallengeIsAhead() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "current", end: "2027-01-20", challenge: "2027-01-22"),
      phase(1, kind: "learn", state: "upcoming", end: "2027-02-05"),
      phase(2, kind: "learn", state: "upcoming", end: "2027-04-10"),
      phase(3, kind: "learn", state: "upcoming", end: "2027-06-01"),
    ])

    XCTAssertEqual(
      plan.phaseEnd(plan.phases[0]),
      PhaseEnd("2027-01-22", estimate: true, month: false, today: "2027-01-04"),
      "the challenge's day, after the last lesson's, ends the phase")
    XCTAssertEqual(plan.phaseEnd(plan.phases[0])?.shown, "~Jan 22")
    XCTAssertEqual(plan.phaseEnd(plan.phases[0])?.spoken, "Ends about Jan 22")
    XCTAssertEqual(plan.phaseEnd(plan.phases[1])?.shown, "~Feb 5")
    XCTAssertEqual(
      plan.phaseEnd(plan.phases[2])?.shown, "~Apr",
      "past six weeks from this week's start, only the month")
    XCTAssertEqual(
      plan.phaseEnd(plan.phases[3])?.shown, "~Jun",
      "the last phase shows its end too, though the finish row shows the plan's")
  }

  func testAnExamPhaseEndsOnABookedDay() throws {
    let plan = try plan(phases: [
      phase(0, kind: "foundations", state: "done", end: "2027-01-02"),
      phase(1, kind: "gaps", state: "current", end: "2027-02-16"),
      phase(2, kind: "finalStretch", state: "upcoming", end: "2027-11-10"),
    ])

    XCTAssertNil(plan.phaseEnd(plan.phases[0]), "nothing for a phase behind")
    XCTAssertEqual(plan.phaseEnd(plan.phases[1])?.shown, "Feb 16")
    XCTAssertEqual(plan.phaseEnd(plan.phases[1])?.spoken, "Ends Feb 16")
    XCTAssertEqual(
      plan.phaseEnd(plan.phases[2])?.shown, "Nov 10", "the last phase ends on its own day")
  }

  func testALastPhaseWithoutADayOfItsOwnEndsWithThePlan() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "current", end: "2027-02-16"),
      phase(1, kind: "learn", state: "upcoming", end: nil),
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[1])?.shown, "~Nov")
  }

  // The web's shapes (`packages/learn/src/journey/phase-dates.test.ts`), on this plan's week of
  // Jan 4, 2027. A short plan's days aren't here: the app doesn't plan a test days away yet.

  func testAPhaseUnderWayIsNamedByItsDayWithNoEstimate() throws {
    let plan = try plan(phases: [phase(0, kind: "foundations", state: "current", end: "2027-01-10")]
    )

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-01-10", estimate: false))
  }

  func testAPhaseBehindTheLearnerOrLeftOutHasNoDate() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "done", end: "2026-12-01"),
      phase(1, kind: "learn", state: "unfinished", end: "2026-12-20"),
      phase(2, kind: "learn", state: "leftOut", end: "2027-01-20"),
      phase(3, kind: "learn", state: "current", end: "2027-02-01"),
    ])

    XCTAssertNil(plan.phaseEnd(plan.phases[0]))
    XCTAssertNil(plan.phaseEnd(plan.phases[1]))
    XCTAssertNil(plan.phaseEnd(plan.phases[2]))
  }

  func testAnEstimateIsSaidByItsDayUpTo42DaysFromThePlansWeekAndByItsMonthAfter() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "current", end: "2027-01-10"),
      phase(1, kind: "learn", state: "upcoming", end: "2027-02-15"),
      phase(2, kind: "learn", state: "upcoming", end: "2027-02-16"),
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[1]), end("2027-02-15", estimate: true))
    XCTAssertEqual(plan.phaseEnd(plan.phases[2]), end("2027-02-16", estimate: true, month: true))
  }

  func testALearningPhaseUnderWayHasItsOwnDayWhileNoChallengeIsAhead() throws {
    let plan = try plan(phases: [phase(0, kind: "learn", state: "current", end: "2027-01-20")])

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-01-20", estimate: false))
  }

  func testAFarPhaseUnderWayIsSaidByItsDayWhileItsChallengeKeepsItAnEstimate() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "current", end: "2027-04-20", challenge: "2027-05-01")
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-05-01", estimate: true))
  }

  func testAChallengeOnItsPhasesLastDayKeepsThatDay() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "current", end: "2027-01-20", challenge: "2027-01-20")
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-01-20", estimate: true))
  }

  func testAPhaseIsLeftAtItsLastLessonOnceItsChallengeIsBehind() throws {
    let plan = try plan(phases: [
      phase(
        0, kind: "learn", state: "current", end: "2027-01-20", challenge: "2027-01-22",
        challengeState: "done")
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-01-20", estimate: false))
  }

  func testAPhaseAfterTheExamIsEstimatedLikeALearningPhase() throws {
    let plan = try plan(phases: [
      phase(0, kind: "gaps", state: "current", end: "2027-01-20"),
      phase(1, kind: "afterExam", state: "upcoming", end: "2027-02-01"),
    ])

    XCTAssertEqual(plan.phaseEnd(plan.phases[1]), end("2027-02-01", estimate: true))
  }

  func testTheLastPhaseBeforeTheExamEndsWithThePlanWhateverComesAfter() throws {
    let plan = try plan(
      phases: [
        phase(0, kind: "learn", state: "current", end: nil),
        phase(1, kind: "afterExam", state: "upcoming", end: nil),
      ], estimateEnd: "2027-02-01")

    XCTAssertEqual(plan.phaseEnd(plan.phases[0]), end("2027-02-01", estimate: true))
  }

  func testAPhaseStillBeingPlannedHasNoDate() throws {
    let plan = try plan(phases: [
      phase(0, kind: "learn", state: "upcoming", end: nil),
      phase(1, kind: "learn", state: "upcoming", end: nil),
    ])

    XCTAssertNil(plan.phaseEnd(plan.phases[0]))
  }

  func testTheFinishIsTheExamsDateAnEstimateWhenTheDateIs() throws {
    let plan = try goalPlanFixture(targetDate: "2027-11-14", targetDateEstimated: true)

    XCTAssert(plan.roadmapFinish(isExam: true)! == ("2027-11-14", true, false))
  }

  func testTheFinishIsThePlansOwnEndAboutSaidByItsMonthWhenFar() throws {
    let near = try goalPlanFixture(estimateEnd: "2027-02-10")
    let far = try goalPlanFixture(estimateEnd: "2027-11-14")

    XCTAssert(near.roadmapFinish(isExam: false)! == ("2027-02-10", true, false))
    XCTAssert(far.roadmapFinish(isExam: false)! == ("2027-11-14", true, true))
  }

  func testThereIsNoFinishWithoutADateOrAnEndOrForAnExamWithoutItsDate() throws {
    XCTAssertNil(try goalPlanFixture(estimateEnd: nil).roadmapFinish(isExam: false))
    XCTAssertNil(try goalPlanFixture(estimateEnd: "2027-02-10").roadmapFinish(isExam: true))
  }

  private func end(_ isoDate: String, estimate: Bool, month: Bool = false) -> PhaseEnd {
    PhaseEnd(isoDate, estimate: estimate, month: month, today: "2027-01-04")
  }

  private func phase(
    _ index: Int, kind: String, state: String, end: String?, challenge: String? = nil,
    challengeState: String = "upcoming"
  ) -> String {
    let checkpoint =
      challenge.map {
        """
        { "date": "\($0)", "locked": false, "planItemId": "c\(index)", "state": "\(challengeState)",
          "when": "date" }
        """
      } ?? "null"

    return """
      { "challengeLeftOut": false, "chapters": [], "checkpoint": \(checkpoint),
        "endDate": \(end.map { "\"\($0)\"" } ?? "null"), "index": \(index), "kind": "\(kind)", "lessonsDone": 0,
        "lessonsTotal": 10, "mocks": { "count": 0, "nextDate": null }, "name": null,
        "startDate": null, "state": "\(state)" }
      """
  }

  private func plan(phases: [String], estimateEnd: String? = "2027-11-14") throws -> GoalPlan {
    try goalPlanFixture(phases: phases, estimateEnd: estimateEnd)
  }
}

/// A plan with these phases and nothing else to say.
func goalPlanFixture(
  phases: [String] = [], estimateEnd: String? = "2027-11-14", targetDate: String? = nil,
  targetDateEstimated: Bool = false
) throws -> GoalPlan {
  let end = estimateEnd.map { "\"\($0)\"" } ?? "null"
  let target = targetDate.map { "\"\($0)\"" } ?? "null"
  let json = """
    {
      "access": { "mocksRequirePlus": false },
      "areas": [], "bases": null, "course": null, "end": null,
      "estimate": { "endDate": \(end), "fullCourseEndDate": null },
      "examChoices": [], "examDocument": "notice", "feasibility": null, "fitOffer": null,
      "goalId": "goal", "phases": [\(phases.joined(separator: ","))], "planId": "plan",
      "ready": true,
      "schedule": {
        "dailyMinutes": 30, "dailyTimes": [15, 30, 45], "fullCourse": false, "studyDays": 7,
        "targetDate": \(target), "targetDateEstimated": \(targetDateEstimated),
        "targetDateNamedMonth": false,
        "shape": {
          "canDiffer": true, "weekdayDays": [1, 2, 3, 4, 5], "weekdays": 30, "weekend": null,
          "weekendDays": [0, 6]
        },
        "weekdayMinutes": [30, 30, 30, 30, 30, 30, 30]
      },
      "status": { "kind": "onTrack" },
      "steering": {
        "difficultyBias": "standard", "lessonsStudied": 0, "practiceBias": "balanced",
        "skippedActivities": []
      },
      "tools": [], "week": { "days": [], "startDate": "2027-01-04" },
      "weekTime": { "studiedMinutes": 0, "targetMinutes": 210 }, "writtenPractice": null
    }
    """
  return try JSONDecoder().decode(GoalPlan.self, from: Data(json.utf8))
}
