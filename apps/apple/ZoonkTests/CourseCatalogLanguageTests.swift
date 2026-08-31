import XCTest

@testable import Zoonk

final class CourseCatalogLanguageTests: XCTestCase {
  func testRegionalLocalizationsUseTheirSupportedBaseLanguage() {
    XCTAssertEqual(courseCatalogLanguage(preferredLocalizations: ["pt-BR"]), "pt")
    XCTAssertEqual(courseCatalogLanguage(preferredLocalizations: ["de_DE"]), "de")
    XCTAssertEqual(courseCatalogLanguage(preferredLocalizations: ["ES-mx"]), "es")
  }

  func testFirstSupportedLocalizationWins() {
    XCTAssertEqual(
      courseCatalogLanguage(preferredLocalizations: ["ja-JP", "fr-CA", "en-US"]),
      "fr")
  }

  func testUnsupportedAndMissingLocalizationsFallBackToEnglish() {
    XCTAssertEqual(courseCatalogLanguage(preferredLocalizations: ["ja-JP"]), "en")
    XCTAssertEqual(courseCatalogLanguage(preferredLocalizations: []), "en")
  }
}
