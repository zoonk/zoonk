import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

/// ✕ pressed while a test's answer is on its way: the server saves it anyway, so what the answer
/// changes (the plan's row: "Question 4 of 8") is read again only once the answer saved, never
/// right away, when the read would still find the question before.
@MainActor
final class LeftMidAnswerTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testAnAnswerLeftOnItsWayStillSavesAndTheRowReadsItAfter() async throws {
    let server = SlowAnswerServer(goalID: goalID)
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())
    let row: Resource<Int> = dependencies.cache.resource(
      audience: .signedIn, domains: [.learnerModel]
    ) { _ in await server.saved }
    await row.load()
    XCTAssertEqual(row.value, 0)

    let answering = Task {
      try await dependencies.onboardingStore.answerPlacement(
        goalID: goalID, itemID: goalID, answer: .dontKnow, duration: .seconds(2))
    }
    try await waitForTestCondition("The answer never left") { await server.arrived == 1 }
    answering.cancel()

    try await waitForTestCondition(
      "The row kept the count from before the answer saved: \(row.value ?? -1)"
    ) {
      // As the plan does whenever it shows again.
      await row.load()
      return row.value == 1
    }
  }
}

extension LeftMidAnswerTests {
  /// ✕ after an answer saved: the plan's test row reads it when the plan shows, for a course's or
  /// a Focus test's answer and for a level test's, with no restart.
  func testTheRowReadsAnAnswerThatSavedBeforeLeaving() async throws {
    let server = SlowAnswerServer(goalID: goalID)
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())
    // The plan's own domains (`PlanStore.plan(goalId:)`).
    let row: Resource<Int> = dependencies.cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress, .userSubscription]
    ) { _ in await server.saved }
    await row.load()

    _ = try await dependencies.onboardingStore.answerPlacement(
      goalID: goalID, itemID: goalID, answer: .dontKnow, duration: .seconds(2))
    await row.load()
    XCTAssertEqual(row.value, 1, "A course's or Focus test's answer")

    _ = try await dependencies.onboardingStore.answerLevelTest(
      goalID: goalID, questionID: "q1", answerIndex: 0, skipped: false, duration: .seconds(2),
      attemptID: "c367d72f-4d87-408a-ba10-6bbcddca31ba")
    await row.load()
    XCTAssertEqual(row.value, 2, "A level test's answer")
  }
}

/// Saves an answer a moment after it arrives, whether or not its sender is still waiting, as the
/// API does, and answers a moment after that. A sender that stops waiting stops the reply only.
private actor SlowAnswerServer: ClientTransport {
  let goalID: String
  private(set) var arrived = 0
  private(set) var saved = 0

  init(goalID: String) { self.goalID = goalID }

  private func save() { saved += 1 }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard operationID == "createPlacementAnswer" || operationID == "answerLanguageLevelTest" else {
      return (HTTPResponse(status: .notFound), nil)
    }

    arrived += 1
    Task.detached {
      try? await Task.sleep(for: .milliseconds(300))
      await self.save()
    }
    try await Task.sleep(for: .milliseconds(400))

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"

    if operationID == "answerLanguageLevelTest" {
      return (
        response,
        HTTPBody(
          #"{"status":"ready","answered":6,"canStop":false,"lastCorrect":null,"levels":[],"next":{"kind":"done"},"showAlphabetNote":false,"targetLanguage":"es","total":12,"estimatedMinutes":6,"attemptId":"c367d72f-4d87-408a-ba10-6bbcddca31ba"}"#
        )
      )
    }

    return (
      response,
      HTTPBody(
        #"""
        {"isCorrect":false,"placement":{"answered":1,"areas":[],"complete":false,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":true,"trueFalseLabels":"trueFalse","focusTest":null,"result":null,"status":"asking","next":null,"attempt":null}}
        """#)
    )
  }
}
