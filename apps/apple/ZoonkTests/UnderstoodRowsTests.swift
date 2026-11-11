import XCTest

@testable import Zoonk

final class UnderstoodRowsTests: XCTestCase {
  private let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 28))!

  func testAMonthTheLearnerNamedStaysOverTheNoticesDayInAnotherMonth() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the bar in March 2027",
        "title": "Pass the bar", "displayName": "Bar exam",
        "details": ["examMonth": 3, "examYear": 2027],
      ],
      examDates: [examDay("2027-04-10")])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.editValue, "2027-03-01", "The plan counts down to the month's start")
    XCTAssertEqual(date.suggestedDate, "2027-04-10")
    XCTAssertNotNil(date.note)
  }

  func testAnOwnDateOffTheNoticesDaysOffersTheNoticesDay() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM", "title": "Pass the ENEM",
        "displayName": "ENEM",
        "targetDate": "2026-11-20",
      ],
      examDates: [examDay("2026-11-08"), examDay("2026-11-15")])

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" })

    XCTAssertEqual(date.editValue, "2026-11-20")
    XCTAssertEqual(date.suggestedDate, "2026-11-08")
    XCTAssertEqual(date.source?.name, "gov.br")
  }

  func testAClearedCountryKeepsItsLanguageRowToPickAgain() throws {
    let goal = try understoodGoal(draft: [
      "kind": "language", "language": "en", "prompt": "learn Spanish", "title": "Learn Spanish",
      "displayName": "Spanish", "targetLanguage": "es",
    ])

    XCTAssertNil(
      UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetLanguage" },
      "The title already names the language")

    let kept = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, countryAsked: true, today: today).first {
        $0.id == "targetLanguage"
      })

    XCTAssertEqual(kept.field, .targetRegion)
  }

  private func examDay(_ date: String) -> [String: Any] {
    [
      "date": date, "estimated": false, "label": "", "registrationClosed": false,
      "source": ["title": NSNull(), "url": "https://www.gov.br/inep/enem"],
    ]
  }

  private func understoodGoal(
    draft: [String: Any],
    examDates: [[String: Any]] = []
  ) throws -> Components.Schemas.UnderstoodGoal {
    try decode(["cutoff": NSNull(), "draft": draft, "examDates": examDates, "regionChoices": []])
  }

  private func decode<Value: Decodable>(_ json: [String: Any]) throws -> Value {
    try JSONDecoder().decode(Value.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
