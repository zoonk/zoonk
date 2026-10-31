import XCTest

@testable import Zoonk

final class LanguageScriptTests: XCTestCase {
  func testALanguageWrittenInAnotherScriptNeedsAnIntro() {
    let languages = ["zh", "zh-TW", "yue", "ja", "ko", "ar", "kk", "sr"]

    XCTAssertEqual(
      languages.filter { !Locale.Language(identifier: $0).usesNonLatinScript }, [])
  }

  func testALanguageWrittenInLatinLettersNeedsNone() {
    let languages = ["pt", "pt-BR", "en", "sr-Latn"]

    XCTAssertEqual(languages.filter { Locale.Language(identifier: $0).usesNonLatinScript }, [])
  }

  func testAnUnknownLanguageCountsAsLatin() {
    XCTAssertFalse(Locale.Language(identifier: "xyz").usesNonLatinScript)
  }
}
