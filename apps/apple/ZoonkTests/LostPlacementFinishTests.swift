import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// A test's finish saved on the server but its reply never arrived: the retry finds it finished
/// (core answers a finished test's finish as stale), and the learner ends on that test's result
/// with its Undo, from the plan and in onboarding.
@MainActor
final class LostPlacementFinishTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testAFinishWhoseReplyWasLostEndsOnItsResult() async throws {
    try await readsWhatVoiceOverReads()

    for onboarding in [false, true] {
      let server = LostFinishServer(goalID: goalID)
      let dependencies = AppDependencies(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
        session: .preview(account: .planTestAccount), imageLoader: .live(),
        subscriptionStore: .live())
      let window = try show(
        NavigationStack {
          PlacementTestFlow(
            goalID: goalID, subject: "Investing",
            offer: CoursePlacementOffer(estimatedMinutes: 4, questions: 8),
            onOnboardingDone: onboarding ? { _ in } : nil
          ) {}
          .appDependencies(dependencies)
        }
        .environment(AppRouter())
        .zoonkStyles())

      try await waitForTestCondition("The finished answers didn't show: \(spoken(in: window))") {
        spoken(in: window).contains("Your answers are saved")
      }
      try await activate("Continue", in: window)
      try await waitForTestCondition("The lost reply didn't offer a retry: \(spoken(in: window))") {
        spoken(in: window).contains { $0.contains("That didn't save") }
      }

      try await activate("Continue", in: window)
      try await waitForTestCondition(
        "The finished test's result didn't show (onboarding: \(onboarding)): \(spoken(in: window))"
      ) {
        spoken(in: window).contains("Why prices move") && spoken(in: window).contains("Undo")
      }
      let finishes = await server.finishes
      XCTAssertEqual(finishes, 2)
      window.isHidden = true
    }
  }
}

/// An open test with nothing left to ask. The first finish applies on the server and its reply is
/// lost; the next is refused as stale, as core refuses a finished test's, and every read after the
/// first finish finds the test's result.
private actor LostFinishServer: ClientTransport {
  let goalID: String
  private(set) var finishes = 0

  init(goalID: String) { self.goalID = goalID }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let payload: String

    switch operationID {
    case "getGoalPlacement":
      payload = finishes == 0 ? over : finished
    case "completeGoalPlacement":
      finishes += 1

      if finishes == 1 {
        throw URLError(.networkConnectionLost)
      }

      var refused = HTTPResponse(status: .conflict)
      refused.headerFields[.contentType] = "application/json"
      return (refused, HTTPBody(#"{"error":{"code":"CONFLICT","message":"Conflict"}}"#))
    default:
      return (HTTPResponse(status: .notFound), nil)
    }

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(payload))
  }

  private var over: String {
    #"""
    {"answered":8,"areas":[],"complete":false,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":true,"trueFalseLabels":"trueFalse","focusTest":null,"result":null,"status":"done","next":null,
     "attempt":{"answered":8,"chapter":"Fractions","estimatedMinutes":4,"id":"\#(goalID)","length":"quick","part":1,"partComplete":false,"questions":8}}
    """#
  }

  private var finished: String {
    #"""
    {"answered":8,"areas":[],"complete":true,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":true,"trueFalseLabels":"trueFalse","focusTest":null,"status":"unavailable","next":null,"attempt":null,
     "result":{"attemptId":"\#(goalID)","changeId":"\#(goalID)","finishedAt":"2026-11-27T10:00:00.000Z","lessonsSkipped":3,"chapter":"Why prices move","course":null,"nextLesson":null}}
    """#
  }
}
