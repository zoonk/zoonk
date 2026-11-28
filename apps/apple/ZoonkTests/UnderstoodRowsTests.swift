import XCTest

@testable import Zoonk

final class UnderstoodRowsTests: XCTestCase {
  private let today = "2026-10-28"

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

  func testTheOfficialDatesDaysLeftCountFromTheDraftsDayNotTheDevices() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ENEM", "title": "Pass the ENEM",
        "displayName": "ENEM", "targetDate": "2026-11-08",
      ],
      examDates: [examDay("2026-11-08")])

    let draftsDay = GoalDate.today(
      now: try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-28T23:30:00Z")),
      timeZone: "Pacific/Kiritimati")

    let date = try XCTUnwrap(
      UnderstoodRows.rows(for: goal, today: draftsDay).first { $0.id == "targetDate" })

    XCTAssertEqual(date.note, "10 days left", "Kiritimati is already on October 29")
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

  func testOnlyAContentCountryOpensThePickerAndAForeignExamsStaysReadOnly() throws {
    let finance = try understoodGoal(
      draft: [
        "kind": "learn", "language": "pt", "prompt": "finanças pessoais",
        "title": "Finanças pessoais", "displayName": "Finanças",
      ],
      contentCountry: [
        "code": "PT", "name": "Portugal", "kind": "content", "editable": true, "source": "home",
        "lessonVariety": ["language": "pt", "region": "BR"], "rebuild": "none",
      ])
    let exam = try understoodGoal(
      draft: [
        "kind": "exam", "language": "pt", "prompt": "passar no CBC", "title": "CBC",
        "displayName": "CBC",
      ],
      contentCountry: [
        "code": "AR", "name": "Argentina", "kind": "exam", "editable": false, "source": "said",
        "lessonVariety": NSNull(), "rebuild": "none",
      ])

    let content = try XCTUnwrap(
      UnderstoodRows.rows(for: finance, today: today).first { $0.id == "contentCountry" })
    let examCountry = try XCTUnwrap(
      UnderstoodRows.rows(for: exam, today: today).first { $0.id == "contentCountry" })

    XCTAssertEqual(content.field, .contentCountry)
    XCTAssertNotNil(content.badge, "It came from where the learner lives")
    XCTAssertNotNil(content.note, "Portugal's lessons are written in Brazilian Portuguese")
    XCTAssertNil(examCountry.field)
    XCTAssertNotNil(examCountry.badge, "The learner named the exam's country")
  }

  func testABookedExamWithoutADayHasNoDateRow() throws {
    let goal = try understoodGoal(
      draft: [
        "kind": "exam", "language": "en", "prompt": "pass the ielts academic",
        "title": "Pass the IELTS Academic", "displayName": "IELTS",
        "details": ["examDay": "booked", "examName": "IELTS Academic"],
      ])

    XCTAssertFalse(
      UnderstoodRows.rows(for: goal, today: today).contains {
        $0.id == "targetDate" || $0.id == "examDates"
      })
  }

  func testOnlyANamedExamWaitsForItsNotice() throws {
    func note(_ details: [String: Any]) throws -> String? {
      let goal = try understoodGoal(
        draft: [
          "kind": "exam", "language": "en", "prompt": "test on Friday",
          "title": "Pass the cell cycle test", "displayName": "Cell cycle", "details": details,
        ])

      return try XCTUnwrap(
        UnderstoodRows.rows(for: goal, today: today).first { $0.id == "targetDate" }
      ).note
    }

    XCTAssertEqual(try note([:]), "Know the date? Set it here.")

    XCTAssertEqual(
      try note(["examName": "OAB"]),
      "The official date comes out in the exam's notice. Know it already? Set it here.")
  }

  func testTheMaterialRowNamesEachSourceAndPastedTextAsYourText() throws {
    let row = try XCTUnwrap(
      UnderstoodRows.materialRow(
        sources: [source("Cell cycle.pdf", .readable), source("", .readable)], missing: false))

    XCTAssertEqual(row.value, "Cell cycle.pdf, Your text")
    XCTAssertEqual(row.note, "Your plan and lessons follow this material")
    XCTAssertNil(row.field, "The material is changed from the goal's words, not on the card")
    XCTAssertNil(UnderstoodRows.materialRow(sources: [], missing: false))
  }

  /// A photo with nothing to read on it stays with the draft, so editing the goal keeps it, but the
  /// card doesn't claim the plan follows it.
  func testTheMaterialRowListsOnlyWhatCouldBeRead() throws {
    let some = try XCTUnwrap(
      UnderstoodRows.materialRow(
        sources: [source("Notes.jpg", .unreadable), source("Cell cycle.pdf", .readable)],
        missing: false))

    XCTAssertEqual(some.value, "Cell cycle.pdf")
    XCTAssertEqual(
      some.note,
      "Your plan and lessons follow only this material. We couldn't read “Notes.jpg”.")

    let several = try XCTUnwrap(
      UnderstoodRows.materialRow(
        sources: [
          source("Notes.jpg", .unreadable), source("Board.jpg", .unreadable),
          source("Cell cycle.pdf", .readable),
        ],
        missing: false))

    XCTAssertEqual(
      several.note,
      "Your plan and lessons follow only this material. We couldn't read the other files.")

    let someGone = try XCTUnwrap(
      UnderstoodRows.materialRow(sources: [source("Cell cycle.pdf", .readable)], missing: true))

    XCTAssertEqual(
      someGone.note, "Your plan and lessons follow only this material. We couldn't read the rest.")

    let none = try XCTUnwrap(
      UnderstoodRows.materialRow(sources: [source("Notes.jpg", .unreadable)], missing: false))

    XCTAssertEqual(none.value, "Notes.jpg", "The note's \"it\" points at what it couldn't read")
    XCTAssertEqual(none.note, "We couldn't read it, so your plan won't follow it.")

    let noneOfSeveral = try XCTUnwrap(
      UnderstoodRows.materialRow(
        sources: [source("Notes.jpg", .unreadable), source("Board.jpg", .unreadable)],
        missing: false))

    XCTAssertEqual(
      noneOfSeveral.note, "We couldn't read these files, so your plan won't follow them.")

    let gone = try XCTUnwrap(UnderstoodRows.materialRow(sources: [], missing: true))

    XCTAssertEqual(gone.note, "We couldn't read it, so your plan won't follow it.")
  }

  private func source(_ title: String, _ readStatus: SourceReadStatus) -> OnboardingDraftSource {
    OnboardingDraftSource(id: UUID().uuidString, readStatus: readStatus, title: title)
  }

  private func examDay(_ date: String) -> [String: Any] {
    [
      "date": date, "estimated": false, "label": "", "registrationClosed": false,
      "source": ["title": NSNull(), "url": "https://www.gov.br/inep/enem"],
    ]
  }

  private func understoodGoal(
    draft: [String: Any],
    examDates: [[String: Any]] = [],
    contentCountry: [String: Any]? = nil
  ) throws -> Components.Schemas.UnderstoodGoal {
    try decode([
      "contentCountry": contentCountry ?? NSNull(), "cutoff": NSNull(), "draft": draft,
      "examDates": examDates, "regionChoices": [], "suggested": [],
    ])
  }

  private func decode<Value: Decodable>(_ json: [String: Any]) throws -> Value {
    try JSONDecoder().decode(Value.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
