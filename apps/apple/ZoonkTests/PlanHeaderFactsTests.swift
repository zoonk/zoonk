import XCTest

@testable import Zoonk

final class PlanHeaderFactsTests: XCTestCase {
  func testAPausedGoalCountsNoDaysToItsOwnDate() throws {
    let plan = try goalPlanFixture(targetDate: "2027-03-05")

    XCTAssertEqual(planDaysLeft(plan, goal: goal(.learn, .active))?.shown, "60 days left")
    XCTAssertNil(planDaysLeft(plan, goal: goal(.learn, .paused)))
    XCTAssertNil(planDaysLeft(plan, goal: goal(.language, .paused)))
  }

  func testAPausedExamStillCountsDownToItsDay() throws {
    let plan = try goalPlanFixture(targetDate: "2027-03-05")

    XCTAssertEqual(planDaysLeft(plan, goal: goal(.exam, .paused))?.shown, "60 days left")
  }

  func testAnEndDateNotSetSaysOnlyThat() {
    let value = PlanEndDateValue(target: nil, isExam: false, today: "2027-01-04")

    XCTAssertEqual(value.shown, "None set")
    XCTAssertFalse(value.isDate)
  }

  func testAnEndDateNotSetSaysTheEstimatedFinishAsEveryEstimate() {
    let day = PlanEndDateValue(
      target: nil, finish: ("2027-01-22", .day), isExam: false, today: "2027-01-04")
    let month = PlanEndDateValue(
      target: nil, finish: ("2027-04-20", .month), isExam: false, today: "2027-01-04")
    let nextYearsMonth = PlanEndDateValue(
      target: nil, finish: ("2028-04-20", .month), isExam: false, today: "2027-01-04")

    XCTAssertEqual(day.shown, "~Jan 22")
    XCTAssertEqual(day.spoken, "About Jan 22")
    XCTAssertTrue(day.isDate)
    XCTAssertEqual(month.shown, "~Apr", "a month names its year only when it isn't this year's")
    XCTAssertEqual(nextYearsMonth.shown, "~Apr 2028")
  }

  func testTheFinishReadoutNamesItsMonthsYearEvenInThisYear() {
    XCTAssertEqual(PlanDate.finishText("2027-04-20", grain: .month), "April 2027")
  }

  func testASetEndDateWinsOverTheEstimatedFinish() {
    let value = PlanEndDateValue(
      target: ("2027-03-05", false, .day), finish: ("2027-01-22", .day), isExam: false,
      today: "2027-01-04")

    XCTAssertEqual(value.shown, "Mar 5")
  }

  func testTheDailyTimeNamesTheWeekendsOwnTime() throws {
    let weekdays = try shape(weekend: nil)
    let both = try shape(weekend: 30)

    XCTAssertEqual(dailyTimeText(weekdays).text, "20\u{00A0}min")
    XCTAssertFalse(dailyTimeText(weekdays).hasWeekend)
    XCTAssertEqual(dailyTimeText(both).text, "20\u{00A0}min · 30\u{00A0}min weekends")
    XCTAssertTrue(dailyTimeText(both).hasWeekend)
  }

  func testTheDailyTimeSaysADayOutsideItsOwnSetting() throws {
    let weekdays = try shape(weekend: nil)
    let both = try shape(weekend: 30)

    XCTAssertEqual(dailyTimeText(weekdays, perDay: true).text, "20\u{00A0}min a day")
    XCTAssertEqual(
      dailyTimeText(both, perDay: true).text, "20\u{00A0}min · 30\u{00A0}min weekends")
  }

  private func goal(_ kind: LearnerGoal.Kind, _ status: LearnerGoal.Status) -> LearnerGoal {
    LearnerGoal(
      dailyMinutes: 30, id: "goal", kind: kind, language: "en", status: status,
      targetDate: "2027-03-05", displayName: "Goal", title: "Goal")
  }

  private func shape(weekend: Int?) throws -> GoalPlan.WeekShape {
    let json = """
      {
        "canDiffer": true, "weekdayDays": [1, 2, 3, 4, 5], "weekdays": 20,
        "weekend": \(weekend.map(String.init) ?? "null"), "weekendDays": [0, 6]
      }
      """
    return try JSONDecoder().decode(GoalPlan.WeekShape.self, from: Data(json.utf8))
  }
}
