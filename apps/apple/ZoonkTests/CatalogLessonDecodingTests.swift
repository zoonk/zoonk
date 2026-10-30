import XCTest

@testable import Zoonk

final class CatalogLessonDecodingTests: XCTestCase {
  private func decode(firstScreen: String) throws -> CatalogLesson {
    let json = """
      {"description": "Why roots pull water up", "estimatedMinutes": 6, "firstScreen": \(firstScreen),
       "id": "019c9bd7-bf11-73cb-9cc8-fe371298190b", "language": "en",
       "summaryIdeas": ["Roots pull water by osmosis"], "title": "Meet the Roots"}
      """
    let generated = try JSONDecoder().decode(
      Components.Schemas.CatalogLesson.self, from: Data(json.utf8))
    return try PracticeJSON.recode(generated)
  }

  func testAFirstQuestionKeepsItsOptionsWithoutTheAnswer() throws {
    let lesson = try decode(
      firstScreen: """
        {"kind": "choice", "context": null, "guess": true, "question": "Where does water enter?",
         "options": [{"id": "a", "text": "Roots"}, {"id": "b", "text": "Leaves"}]}
        """)

    XCTAssertEqual(
      lesson.firstScreen,
      .choice(
        context: nil, guess: true,
        options: [.init(id: "a", text: "Roots"), .init(id: "b", text: "Leaves")],
        question: "Where does water enter?"))
  }

  func testATextOrPlainStartAndAnUnwrittenLessonDecode() throws {
    XCTAssertEqual(
      try decode(firstScreen: #"{"kind": "text", "text": "Plants drink."}"#).firstScreen,
      .text("Plants drink."))
    XCTAssertEqual(try decode(firstScreen: #"{"kind": "start"}"#).firstScreen, .start)
    XCTAssertNil(try decode(firstScreen: "null").firstScreen)
  }
}
