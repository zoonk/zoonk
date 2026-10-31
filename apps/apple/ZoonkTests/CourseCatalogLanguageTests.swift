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

  func testSpanishWritesNumbersTheMexicanWay() {
    XCTAssertEqual(
      ActivityNumberFormat.format(1234.5, digits: 1, locale: formattingLocale("es")), "1,234.5")
    XCTAssertEqual(formattingLocale("pt"), Locale(identifier: "pt"))
  }
}
