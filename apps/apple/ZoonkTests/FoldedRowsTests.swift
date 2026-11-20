import XCTest

@testable import Zoonk

/// Main's `getFoldedRows`: Today's fold says "lessons" only when every row it hides is one.
final class FoldedRowsTests: XCTestCase {
  func testAFoldOfLessonsSaysLessons() throws {
    XCTAssertEqual(
      StudyDay.moreLabel(
        hidden: [try block(kind: "learn"), try block(kind: "learn")], lessonsAhead: false),
      "2 more lessons")
  }

  func testAFoldWithAnythingElseSaysMore() throws {
    XCTAssertEqual(
      StudyDay.moreLabel(
        hidden: [try block(kind: "learn"), try block(kind: "practice")], lessonsAhead: false),
      "2 more")
    XCTAssertEqual(
      StudyDay.moreLabel(hidden: [try block(kind: "learn")], lessonsAhead: true), "2 more")
  }

  private func block(kind: String) throws -> StudyBlock {
    let json = """
      {"id":"b1","answered":0,"areaId":null,"areas":[],"brainPower":0,
      "canDo":null,"canTestOut":false,"capsules":[],"chapterId":null,"checkpoint":null,
      "estimatedBrainPower":5,"estimatedMinutes":5,"extra":false,"fullReview":false,
      "kind":"\(kind)","lessonId":null,"mistakesOnly":false,"netScored":false,"opensInPlayer":false,
      "oftenTested":false,"planItemId":null,"planItemKey":null,"position":0,"questions":6,
      "refresh":false,"reinforcement":false,"screen":"session","status":"pending",
      "subject":"Biology","title":"A lesson","topics":[],"waitReason":null,"weakest":false}
      """
    return try JSONDecoder().decode(StudyBlock.self, from: Data(json.utf8))
  }
}
