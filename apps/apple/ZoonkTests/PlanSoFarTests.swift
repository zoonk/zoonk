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

  func testALanguageGoalNamesTheLanguageItsLevelIsIn() throws {
    let facts = PlanFact.all(
      of: try goal(kind: "language", targetLanguage: "es"), today: "2026-11-18",
      locale: Locale(identifier: "en_US"))
    let level = try XCTUnwrap(facts.first { $0.id == "level" })

    XCTAssertEqual(String(localized: level.label), "Spanish level")
  }

  func testAnotherGoalsLevelIsCalledLevel() throws {
    let facts = PlanFact.all(of: try goal(kind: "learn"), today: "2026-11-18")
    let level = try XCTUnwrap(facts.first { $0.id == "level" })

    XCTAssertEqual(String(localized: level.label), "Level")
  }

  private func goal(kind: String, targetLanguage: String? = nil) throws
    -> Components.Schemas.Goal
  {
    let json: [String: Any] = [
      "contentCountry": NSNull(), "countryDependent": false,
      "createdAt": 0, "dailyMinutes": 15,
      "details": ["answered": ["targetDate", "level"], "level": "basic"],
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
