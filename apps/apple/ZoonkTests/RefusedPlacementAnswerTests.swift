import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// Another device stopped the test while this one showed a question: core refuses the answer, and
/// a read finds the test finished, so the learner sees its result instead of a question they can
/// never send.
@MainActor
final class RefusedPlacementAnswerTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testAnAnswerRefusedAfterAnotherDeviceStoppedTheTestShowsItsResult() async throws {
    let server = StoppedElsewhereServer(goalID: goalID)
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())

    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack {
        PlacementTestFlow(goalID: goalID, subject: "Investing") {}
          .appDependencies(dependencies)
      }
      .environment(AppRouter())
      .zoonkStyles())

    try await waitForTestCondition("The question didn't show: \(spoken(in: window))") {
      spoken(in: window).contains { $0.contains("Which fraction is smaller?") }
    }
    try await activate("I don't know yet", in: window)

    try await waitForTestCondition("The finished test's result didn't show: \(spoken(in: window))")
    {
      spoken(in: window).contains("Why prices move")
    }
    XCTAssertFalse(spoken(in: window).contains { $0.contains("Which fraction is smaller?") })
    let answers = await server.answers
    XCTAssertEqual(answers, 1, "Nothing sends the refused answer again")
  }
}

/// Shows question two of an open test until an answer comes, which it refuses as core does for a
/// test another device finished; every read after that finds the test's result.
private actor StoppedElsewhereServer: ClientTransport {
  let goalID: String
  private(set) var answers = 0

  init(goalID: String) { self.goalID = goalID }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let payload: String

    switch operationID {
    case "getGoalPlacement":
      payload = answers == 0 ? asking : stopped
    case "createPlacementAnswer":
      answers += 1
      var refused = HTTPResponse(status: .unprocessableContent)
      refused.headerFields[.contentType] = "application/json"
      return (refused, HTTPBody(#"{"error":{"code":"INVALID_ITEM","message":"Invalid item"}}"#))
    default:
      return (HTTPResponse(status: .notFound), nil)
    }

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(payload))
  }

  private var asking: String {
    #"""
    {"answered":1,"areas":[],"complete":false,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":true,"trueFalseLabels":"trueFalse","focusTest":null,"result":null,"status":"asking",
     "next":{"context":null,"image":null,"itemId":"\#(goalID)","skillId":"\#(goalID)","visual":null,"format":"multipleChoice","options":["1/2","1/3"],"question":"Which fraction is smaller?","select":1},
     "attempt":{"answered":1,"chapter":"Fractions","estimatedMinutes":4,"id":"\#(goalID)","length":"quick","part":1,"partComplete":false,"questions":8}}
    """#
  }

  private var stopped: String {
    #"""
    {"answered":1,"areas":[],"complete":true,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":true,"trueFalseLabels":"trueFalse","focusTest":null,"status":"unavailable","next":null,"attempt":null,
     "result":{"attemptId":"\#(goalID)","finishedAt":"2026-11-27T10:00:00.000Z","lessonsSkipped":2,"chapter":"Why prices move","course":null,"nextLesson":null}}
    """#
  }
}
