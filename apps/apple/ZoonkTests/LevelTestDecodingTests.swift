import XCTest

@testable import Zoonk

final class LevelTestDecodingTests: XCTestCase {
  func testDecodesTheAlphabetNoteThroughTheGeneratedContract() throws {
    let fixtures = [
      (
        #"{"expectedSeconds":120,"showAlphabetNote":true,"startedAt":null,"status":"preparing"}"#,
        true
      ),
      (
        #"{"answered":0,"lastCorrect":null,"levels":[],"next":{"kind":"done"},"showAlphabetNote":false,"status":"ready","targetLanguage":"hmn","total":7}"#,
        false
      ),
    ]

    for (json, showAlphabetNote) in fixtures {
      let generated = try JSONDecoder().decode(
        Components.Schemas.LanguageLevelTest.self, from: Data(json.utf8))
      let test: LevelTest = try PracticeJSON.recode(generated)

      XCTAssertEqual(test.showAlphabetNote, showAlphabetNote)
    }
  }
}
