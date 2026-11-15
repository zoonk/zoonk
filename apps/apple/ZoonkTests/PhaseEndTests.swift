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

  private func phase(
    _ index: Int, kind: String, state: String, end: String?, challenge: String? = nil
  ) -> String {
    let checkpoint =
      challenge.map {
        """
        { "date": "\($0)", "locked": false, "planItemId": "c\(index)", "state": "upcoming",
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

  private func plan(phases: [String]) throws -> GoalPlan {
    let json = """
      {
        "access": { "mocksRequirePlus": false },
        "areas": [], "bases": null, "course": null, "end": null,
        "estimate": { "endDate": "2027-11-14", "fullCourseEndDate": null },
        "examChoices": [], "examDocument": "notice", "feasibility": null, "fitOffer": null,
        "goalId": "goal", "phases": [\(phases.joined(separator: ","))], "planId": "plan",
        "ready": true,
        "schedule": {
          "dailyMinutes": 30, "dailyTimes": [15, 30, 45], "fullCourse": false, "studyDays": 7,
          "targetDate": null, "targetDateEstimated": false, "targetDateNamedMonth": false,
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
}
