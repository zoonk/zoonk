import XCTest

@testable import Zoonk

/// The plan's test row and a test's result read through the generated client, whose dates arrive
/// as `Date`s rather than the API's text.
final class PlacementTestContractTests: XCTestCase {
  private let finishedAt = Date(timeIntervalSince1970: 1_795_278_219)

  func testALearnCoursesLastResultReadsFromThePlan() throws {
    let test = try planTest(
      #"""
      {"attempt":null,"estimatedMinutes":27,"kind":"learn","state":"result",
       "result":{"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
                 "finishedAt":"2026-11-21T16:23:39Z","lessonsSkipped":3}}
      """#)

    XCTAssertEqual(test.result?.lessonsSkipped, 3)
    XCTAssertEqual(test.result?.finishedAt, finishedAt)
  }

  func testALanguageCoursesResultKeepsEachSkillsRange() throws {
    let test = try planTest(
      #"""
      {"attempt":null,"estimatedMinutes":40,"kind":"language","nextTestOutLevel":"B2",
       "state":"result",
       "result":{"attemptId":null,"finishedAt":"2026-11-21T16:23:39Z","lessonsSkipped":12,
                 "levelsSkipped":["A1"],
                 "ranges":{"listening":{"high":"B1","low":"A2"},
                           "reading":{"high":"B2","low":"B1"}}}}
      """#)

    XCTAssertEqual(test.nextTestOutLevel, "B2")
    let result = try XCTUnwrap(test.languageResult)
    let standing = LanguageStanding(
      goal: .init(targetLanguage: "en"), level: .init(label: "B2+", target: "C1"), levels: [])
    XCTAssertEqual(
      standing.levelText(ranges: PlacementTestCopy.rangeFacts(result.skillRanges)),
      "Reading B1–B2\nListening A2–B1")
  }

  func testALevelTestWhoseQuestionsAreBeingWrittenReads() throws {
    let test = try read(
      #"""
      {"status":"preparing","expectedSeconds":90,"showAlphabetNote":false,
       "startedAt":"2026-11-21T16:23:39Z","attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
       "length":"quick"}
      """#, as: Components.Schemas.LanguageLevelTest.self, then: LevelTest.self)

    XCTAssertEqual(test.status, .preparing)
    XCTAssertEqual(test.startedAt, finishedAt)
    XCTAssertEqual(test.length, .quick)
  }

  func testALevelTestOutsResultReads() throws {
    let testOut = try read(
      #"""
      {"answered":4,"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba","level":"B2","next":null,
       "preparing":false,"total":4,
       "result":{"changeId":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
                 "finishedAt":"2026-11-21T16:23:39Z","lessonsSkipped":6,"topicsSkipped":[]}}
      """#, as: Components.Schemas.LanguageLevelTestOut.self, then: LevelTestOut.self)

    XCTAssertEqual(testOut.result?.changeId, "c367d72f-4d87-408a-ba10-6bbcddca31ba")
    XCTAssertEqual(testOut.result?.lessonsSkipped, 6)
    XCTAssertEqual(testOut.result?.finishedAt, finishedAt)
  }

  private func planTest(_ json: String) throws -> PlanPlacementTest {
    try read(json, as: Components.Schemas.PlanPlacementTest.self, then: PlanPlacementTest.self)
  }

  private func read<Generated: Codable, Model: Decodable>(
    _ json: String, as generated: Generated.Type, then model: Model.Type
  ) throws -> Model {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    return try PracticeJSON.recode(
      try decoder.decode(generated, from: Data(json.utf8)), as: model)
  }
}
