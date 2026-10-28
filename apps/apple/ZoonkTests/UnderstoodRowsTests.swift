import XCTest

@testable import Zoonk

final class UnderstoodRowsTests: XCTestCase {
  private let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 28))!

  func testADetailTheTitleAlreadySaysGetsNoRowOfItsOwn() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM for medicine",
        "title": "Pass the ENEM for medicine",
        "details": ["targetCourse": "medicine", "reason": "I want to be a doctor"],
      ])

    let rows = UnderstoodRows.rows(for: goal, today: today)

    XCTAssertEqual(rows.map(\.id), ["title", "targetDate", "reason"])
    XCTAssertEqual(rows.first?.field, .title)
  }

  func testAnExamWithoutItsDateSaysItsToBeConfirmed() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the bar", "title": "Pass the bar",
        "details": ["examYear": 2027],
      ])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.value, "2027, to be confirmed")
    XCTAssertEqual(date.field, .targetDate)
  }

  func testAnOfficialDateCountsTheDaysLeftAndLinksItsSource() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM", "title": "Pass the ENEM",
        "targetDate": "2026-11-08",
      ],
      examDates: [
        [
          "date": "2026-11-08", "estimated": false, "label": "Day 1", "registrationClosed": true,
          "source": ["title": NSNull(), "url": "https://www.gov.br/inep/enem"],
        ]
      ])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.note, "11 days left")
    XCTAssertEqual(date.source?.name, "gov.br")
  }

  func testAMonthTheLearnerNamedStaysOverTheNoticesDayInAnotherMonth() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the bar in March 2027",
        "title": "Pass the bar", "details": ["examMonth": 3, "examYear": 2027],
      ],
      examDates: [examDay("2027-04-10")])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.editValue, "2027-03-01", "The plan counts down to the month's start")
    XCTAssertEqual(date.suggestedDate, "2027-04-10")
    XCTAssertNotNil(date.note)
  }

  func testAnExamHeldSeveralTimesAYearOffersItsNextOpenSittings() throws {
    let goal = try understoodGoal(
      draft: ["kind": "exam", "language": "en", "prompt": "take the SAT", "title": "Take the SAT"],
      examDates: [
        examDay("2026-11-07", closed: true), examDay("2026-12-05"), examDay("2027-03-13"),
        examDay("2027-05-08"), examDay("2027-06-05"),
      ])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "examDates" })

    XCTAssertEqual(date.value, "Pick your date")
    XCTAssertEqual(date.choiceDates, ["2026-12-05", "2027-03-13", "2027-05-08"])
    XCTAssertEqual(date.editValue, "2026-12-05")
  }

  func testAnOwnDateOffTheNoticesDaysOffersTheNoticesDay() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM", "title": "Pass the ENEM",
        "targetDate": "2026-11-20",
      ],
      examDates: [examDay("2026-11-08"), examDay("2026-11-15")])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.editValue, "2026-11-20")
    XCTAssertEqual(date.suggestedDate, "2026-11-08")
    XCTAssertEqual(date.source?.name, "gov.br")
  }

  func testOneExamOverTwoSundaysListsItsDaysWithTheYearOnce() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM", "title": "Pass the ENEM",
      ],
      examDates: [examDay("2026-11-08"), examDay("2026-11-15")])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "examDates" })

    XCTAssertEqual(date.value.components(separatedBy: "2026").count, 2, "The year is said once")
    XCTAssertEqual(date.editValue, "2026-11-08")
    XCTAssertTrue(date.choiceDates.isEmpty)
  }

  func testTheCardShowsTheMinutesOnlyWhenTheWordsSaidThem() throws {
    let said = try understanding(answered: ["schedule"])
    let unsaid = try understanding(answered: [])

    XCTAssertEqual(UnderstoodRows.scheduleRow(said)?.id, "schedule")
    XCTAssertNil(UnderstoodRows.scheduleRow(unsaid))
  }

  func testAGoalLimitPlusLiftsShowsAsThePlusNotice() {
    let free = OnboardingLimit(period: "day", resource: "activeGoals", tier: "free")
    let guest = OnboardingLimit(period: "total", resource: "goal", tier: "guest")

    XCTAssertEqual(GoalError.creating(OnboardingError.goalLimit(free)).limit, .oneActiveGoal)
    XCTAssertTrue(GoalLimitReason.oneActiveGoal.isPlusLimit)
    XCTAssertTrue(GoalError.creating(OnboardingError.goalLimit(guest)).needsAccount)
    XCTAssertTrue(GoalError.starting(OnboardingError.limit(guest)).needsAccount)
  }

  private func examDay(_ date: String, closed: Bool = false) -> [String: Any] {
    [
      "date": date, "estimated": false, "label": "", "registrationClosed": closed,
      "source": ["title": NSNull(), "url": "https://www.gov.br/inep/enem"],
    ]
  }

  private func understoodGoal(
    draft: [String: Any],
    examDates: [[String: Any]] = []
  ) throws -> Components.Schemas.UnderstoodGoal {
    try decode(["cutoff": NSNull(), "draft": draft, "examDates": examDates])
  }

  private func understanding(
    answered: [String]
  ) throws -> Components.Schemas.GoalUnderstanding.Case1Payload {
    try decode([
      "status": "goals",
      "schedule": [
        "dailyMinutes": 30, "studyDays": NSNull(), "studyTime": NSNull(), "studyTimeNote": NSNull(),
      ],
      "goals": [
        [
          "cutoff": NSNull(), "examDates": [],
          "draft": [
            "kind": "learn", "language": "en", "prompt": "learn chess", "title": "Learn chess",
            "details": ["answered": answered],
          ],
        ]
      ],
    ])
  }

  private func decode<Value: Decodable>(_ json: [String: Any]) throws -> Value {
    try JSONDecoder().decode(Value.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
