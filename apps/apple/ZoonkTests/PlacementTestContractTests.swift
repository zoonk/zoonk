import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

/// The plan's test row and a test's result read through the generated client, whose dates arrive
/// as `Date`s rather than the API's text.
final class PlacementTestContractTests: XCTestCase {
  private let finishedAt = Date(timeIntervalSince1970: 1_795_278_219)

  func testALearnCoursesLastResultReadsWhereTheLearnerStarts() throws {
    let test = try planTest(
      #"""
      {"attempt":null,"estimatedMinutes":4,"kind":"learn","offer":null,"state":"result",
       "result":{"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
                 "finishedAt":"2026-11-21T16:23:39Z","lessonsSkipped":4,
                 "chapter":"Why prices move",
                 "course":{"lessons":9,"chapters":[{"lessons":4,"skipped":4,"start":false},
                                                   {"lessons":5,"skipped":0,"start":true}]},
                 "nextLesson":{"id":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
                               "title":"News, results and expectations","estimatedMinutes":5,
                               "chapter":"Why prices move"}}}
      """#)

    let result = try XCTUnwrap(test.result)
    XCTAssertEqual(result.lessonsSkipped, 4)
    XCTAssertEqual(result.finishedAt, finishedAt)
    XCTAssertEqual(result.chapter, "Why prices move")
    XCTAssertEqual(result.course?.chapters.map(\.start), [false, true])
    XCTAssertEqual(result.nextLesson?.estimatedMinutes, 5)
    XCTAssertEqual(
      plainFacts(PlacementTestCopy.planLine(test)).first, "4 lessons skipped",
      "The plan's row says what the last test found")
  }

  func testAResultFromBeforeThePlanHasNoCourseToDraw() throws {
    let test = try planTest(
      #"""
      {"attempt":null,"estimatedMinutes":4,"kind":"learn","offer":null,"state":"result",
       "result":{"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba",
                 "finishedAt":"2026-11-21T16:23:39Z","lessonsSkipped":0,
                 "chapter":null,"course":null,"nextLesson":null}}
      """#)

    let end = PlacementTestEnd(read: try XCTUnwrap(test.result))
    XCTAssertNil(end.course)
    XCTAssertNil(end.chapter)
    XCTAssertNil(end.nextLesson)
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
       "estimatedMinutes":6,"total":12}
      """#, as: Components.Schemas.LanguageLevelTest.self, then: LevelTest.self)

    XCTAssertEqual(test.status, .preparing)
    XCTAssertEqual(test.startedAt, finishedAt)
    XCTAssertEqual(test.total, 12, "The ceiling is told before the first question")
    XCTAssertEqual(test.estimatedMinutes, 6)
  }

  func testAnOpenTestSaysItsQuestionOfItsCeilingOnThePlan() throws {
    let test = try planTest(
      #"""
      {"estimatedMinutes":4,"kind":"learn","offer":null,"result":null,"state":"continue",
       "attempt":{"answered":3,"chapter":null,"estimatedMinutes":4,
                  "id":"c367d72f-4d87-408a-ba10-6bbcddca31ba","length":"quick","part":1,
                  "partComplete":false,"questions":8}}
      """#)

    XCTAssertEqual(test.attempt?.questions, 8)
    XCTAssertEqual(PlacementTestCopy.planLine(test), ["In progress", "Question 4 of 8"])

    let atTheCeiling = try planTest(
      #"""
      {"estimatedMinutes":4,"kind":"learn","offer":null,"result":null,"state":"continue",
       "attempt":{"answered":8,"chapter":null,"estimatedMinutes":4,
                  "id":"c367d72f-4d87-408a-ba10-6bbcddca31ba","length":"quick","part":1,
                  "partComplete":false,"questions":8}}
      """#)
    XCTAssertEqual(
      PlacementTestCopy.planLine(atTheCeiling), ["In progress"],
      "With no question left to ask, the row names none")

    let languageAtTheCeiling = try planTest(
      #"""
      {"answered":12,"attempt":null,"estimatedMinutes":6,"kind":"language",
       "nextTestOutLevel":null,"result":null,"state":"continue","total":12}
      """#)
    XCTAssertEqual(PlacementTestCopy.planLine(languageAtTheCeiling), ["In progress"])

    let fresh = try planTest(
      #"""
      {"estimatedMinutes":4,"kind":"learn","offer":{"estimatedMinutes":4,"questions":8},
       "result":null,"state":"start","attempt":null}
      """#)
    XCTAssertEqual(
      plainFacts(PlacementTestCopy.planLine(fresh)),
      ["Skip lessons you already know", "About 4 min"])
  }

  func testAnOnboardingTestStepReadsItsModeAndItsOffer() throws {
    let step = try read(
      #"""
      {"mode":"offer","test":{"kind":"course","offer":{"estimatedMinutes":4,"questions":8}}}
      """#, as: Components.Schemas.OnboardingPlacement.self, then: OnboardingTestStep.self)

    XCTAssertEqual(step.mode, .offer)
    XCTAssertEqual(step.kind, .course)
    let card = TestCopy.courseCard(try XCTUnwrap(step.courseOffer))
    XCTAssertEqual(card.line, "Up to 8 questions")
    XCTAssertEqual(card.minutes, 4)

    let direct = try read(
      #"{"mode":"direct","test":{"kind":"language"}}"#,
      as: Components.Schemas.OnboardingPlacement.self, then: OnboardingTestStep.self)
    XCTAssertEqual(direct.mode, .direct)
    XCTAssertNil(direct.courseOffer)
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

  @MainActor
  func testCantListenNowSendsItsDeferralWithTheAnswer() async throws {
    let server = LevelTestAnswerServer()
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())

    let test = try await dependencies.onboardingStore.answerLevelTest(
      goalID: "00000000-0000-4000-8000-0000000000a1", questionID: "listening-1",
      answerIndex: nil, skipped: false, audioDeferred: true, duration: .seconds(2),
      attemptID: "c367d72f-4d87-408a-ba10-6bbcddca31ba")

    let body = await server.body
    let sent = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
    XCTAssertEqual(sent["audioDeferred"] as? Bool, true)
    XCTAssertEqual(sent["questionId"] as? String, "listening-1")
    XCTAssertNil(
      LanguageTestPhase(test, attemptID: "c367d72f-4d87-408a-ba10-6bbcddca31ba"),
      "The test asks nothing more, so it goes to its result")
  }

  @MainActor
  func testAStopSendsTheAnswersTheLearnerSawSoAnOlderPositionIsRefused() async throws {
    let server = FinishRefusingServer()
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())
    let attempt = PlacementAttempt(
      answered: 3, chapter: nil, estimatedMinutes: 4, id: "c367d72f-4d87-408a-ba10-6bbcddca31ba",
      questions: 8)

    let outcome = try await dependencies.onboardingStore.finishPlacementTest(
      goalID: "00000000-0000-4000-8000-0000000000a1", attempt: attempt, stoppedAt: 3)

    let body = await server.body
    let sent = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
    XCTAssertEqual(sent["answered"] as? Int, 3)
    XCTAssertEqual(sent["attemptId"] as? String, attempt.id)
    guard case .stale = outcome else {
      return XCTFail("A refused stop reads the test again")
    }
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

/// Answers a level test answer with a test that asks nothing more, keeping the body it was sent.
private actor LevelTestAnswerServer: ClientTransport {
  private(set) var body = Data()

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard operationID == "answerLanguageLevelTest" else {
      return (HTTPResponse(status: .notFound), nil)
    }

    if let body {
      self.body = try await Data(collecting: body, upTo: 1 << 20)
    }

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"
    return (
      response,
      HTTPBody(
        #"{"status":"ready","answered":6,"canStop":false,"lastCorrect":null,"levels":[],"next":{"kind":"done"},"showAlphabetNote":false,"targetLanguage":"es","total":12,"estimatedMinutes":6,"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba"}"#
      )
    )
  }
}

/// Refuses a finish, as core does for a position another device moved past, keeping its body.
private actor FinishRefusingServer: ClientTransport {
  private(set) var body = Data()

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard operationID == "completeGoalPlacement" else {
      return (HTTPResponse(status: .notFound), nil)
    }

    if let body {
      self.body = try await Data(collecting: body, upTo: 1 << 20)
    }

    var response = HTTPResponse(status: .conflict)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(#"{"error":{"code":"CONFLICT","message":"Conflict"}}"#))
  }
}
