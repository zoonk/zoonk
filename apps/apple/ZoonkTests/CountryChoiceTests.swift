import XCTest

@testable import Zoonk

final class CountryChoiceTests: XCTestCase {
  func testSearchMatchesAnyWordsStartIgnoringCaseAndAccents() {
    XCTAssertTrue(countryMatches("Estados Unidos", query: "uni"))
    XCTAssertTrue(countryMatches("Reino Unido", query: "reino u"))
    XCTAssertTrue(countryMatches("Áustria", query: "aus"))
    XCTAssertTrue(countryMatches("Guiné-Bissau", query: "bissau"))
    XCTAssertFalse(countryMatches("Brasil", query: "asil"), "Only from a word's start")
  }

  func testACoreSuggestionKeepsWhereTheLearnerLivesAndItsLessonLanguage() throws {
    let choices = try JSONDecoder().decode(
      [CountryChoice].self,
      from: Data(
        #"""
        [{"code":"PT","name":"Portugal","lessonVariety":{"language":"pt","region":"BR"},"tag":"home"},
         {"code":"BR","name":"Brasil","lessonVariety":null,"tag":null}]
        """#.utf8))

    XCTAssertEqual(
      choices,
      [
        CountryChoice(
          code: "PT", name: "Portugal", isHome: true,
          lessonVariety: LessonVariety(language: "pt", region: "BR")),
        CountryChoice(code: "BR", name: "Brasil"),
      ])
  }

  func testALessonLanguageIsNamedInItsOwnLanguageLikeTheCountriesBesideIt() {
    XCTAssertEqual(LessonVariety(language: "pt", region: "BR").name, "Português (Brasil)")
    XCTAssertEqual(LessonVariety(language: "es", region: "MX").name, "Español (México)")
  }
}
