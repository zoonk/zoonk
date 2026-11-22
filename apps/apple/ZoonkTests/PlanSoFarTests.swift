import Foundation
import XCTest

@testable import Zoonk

/// The setup rail words a date and a level as main's `PlanReceipt` does.
final class PlanSoFarTests: XCTestCase {
  func testAGoalWithoutADateSaysNoneIsSet() throws {
    let facts = PlanFact.all(of: try goal(kind: "learn"), today: "2026-11-18")

    XCTAssertEqual(facts.first { $0.id == "date" }?.value, "None set")
  }

  func testAnExamWithoutADateSaysItsToBeConfirmed() throws {
    let facts = PlanFact.all(of: try goal(kind: "exam"), today: "2026-11-18")

    XCTAssertEqual(facts.first { $0.id == "date" }?.value, "To be confirmed")
  }

  func testALanguageGoalWithoutATestResultShowsNoLevel() throws {
    let facts = PlanFact.all(
      of: try goal(kind: "language", targetLanguage: "es"), today: "2026-11-18")

    XCTAssertNil(facts.first { $0.id == "level" })
  }

  func testALanguageGoalShowsOnlyTheRangesTheTestFound() throws {
    let facts = PlanFact.all(
      of: try goal(
        kind: "language", targetLanguage: "es",
        details: [
          "level": "B1+",
          "levelTest": [
            "lastResult": ["ranges": ["reading": ["low": "B1", "high": "B2"]]]
          ],
        ]),
      today: "2026-11-18")
    let level = try XCTUnwrap(facts.first { $0.id == "level" })

    XCTAssertEqual(level.value, "Reading B1–B2")
  }

  func testAnotherGoalsLevelIsCalledWhatYouKnow() throws {
    let facts = PlanFact.all(of: try goal(kind: "learn"), today: "2026-11-18")
    let level = try XCTUnwrap(facts.first { $0.id == "level" })

    XCTAssertEqual(String(localized: level.label), "What you know")
  }

  private func goal(
    kind: String, targetLanguage: String? = nil,
    details: [String: Any] = ["answered": ["targetDate", "level"], "level": "basic"]
  ) throws -> Components.Schemas.Goal {
    let json: [String: Any] = [
      "contentCountry": NSNull(), "countryDependent": false,
      "createdAt": 0, "dailyMinutes": 15,
      "details": details,
      "examBlueprintId": NSNull(), "examCountry": NSNull(), "examplesCountry": NSNull(),
      "id": "00000000-0000-4000-8000-000000000001", "isActive": true, "kind": kind,
      "language": "en", "languageCountry": ["code": "US", "name": "United States"],
      "languageFlag": NSNull(), "plan": NSNull(), "primaryCourseId": NSNull(),
      "prompt": "Vaccines", "regionChoices": [], "status": "active", "studyDays": [],
      "suggested": [], "studyTime": NSNull(), "targetDate": NSNull(),
      "targetLanguage": targetLanguage ?? NSNull(), "targetRegion": NSNull(),
      "timezone": NSNull(), "title": "Vaccines", "displayName": "Vaccines",
    ]

    return try JSONDecoder().decode(
      Components.Schemas.Goal.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
