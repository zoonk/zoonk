import XCTest

@testable import Zoonk

/// A practice is named after the topic most of its questions are on, so two practices on one
/// subject in a day never share a name, and after its subjects only when it has no topics (main's
/// `getPracticeFocus`). Today's row and the practice's own page read the same name.
final class BlockTitleTests: XCTestCase {
  private let topics = #"["Reading slope as a rate", "Using powers of ten"]"#

  func testAPracticeIsNamedAfterItsFirstTopic() throws {
    let block: StudyBlock = try decode(practice(topics: topics))

    XCTAssertEqual(block.displayTitle, "Practice: Reading slope as a rate")
    XCTAssertEqual(
      block.label, "1 more topic", "the title names the first topic; the line counts the rest")
  }

  func testAnExtraPracticeIsNamedAfterItsFirstTopic() throws {
    let block: StudyBlock = try decode(practice(topics: topics, extra: true))

    XCTAssertEqual(block.displayTitle, "Bonus practice: Reading slope as a rate")
  }

  func testAPracticeOnOneTopicShowsItsSubjectUnderIt() throws {
    let block: StudyBlock = try decode(practice(topics: #"["Reading slope as a rate"]"#))

    XCTAssertEqual(block.displayTitle, "Practice: Reading slope as a rate")
    XCTAssertEqual(block.label, "Quantum physics from scratch")
  }

  func testAPracticeWithoutTopicsIsNamedAfterItsSubjects() throws {
    let block: StudyBlock = try decode(practice(topics: "[]"))

    XCTAssertEqual(block.displayTitle, "Practice: Quantum physics from scratch")
    XCTAssertEqual(block.label, "Quantum physics from scratch")
  }

  func testThePracticePageNamesTheBlockAsTodaysRowDoes() throws {
    for json in [
      practice(topics: topics), practice(topics: "[]"), practice(topics: "[]", extra: true),
    ] {
      let row: StudyBlock = try decode(json)
      let page: PracticeBlock = try decode(json)

      XCTAssertEqual(page.displayTitle, row.displayTitle)
    }
  }

  private func practice(topics: String, extra: Bool = false) -> String {
    """
    {"id":"b1","answered":0,"areaId":null,"areas":["Quantum physics from scratch"],"brainPower":0,
    "canDo":null,"canTestOut":false,"capsules":[],"chapterId":null,"checkpoint":null,
    "estimatedBrainPower":5,"estimatedMinutes":5,"extra":\(extra),"fullReview":false,
    "kind":"practice","lessonId":null,"mistakesOnly":false,"netScored":false,"opensInPlayer":false,
    "oftenTested":false,"planItemId":null,"planItemKey":null,"position":0,"preparing":false,"questions":6,
    "refresh":false,"reinforcement":false,"screen":"session","status":"pending",
    "subject":"Quantum physics from scratch","title":null,"topics":\(topics),"waitReason":null,
    "weakest":false}
    """
  }

  private func decode<Value: Decodable>(_ json: String) throws -> Value {
    try JSONDecoder().decode(Value.self, from: Data(json.utf8))
  }
}
