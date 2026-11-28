import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// A test the learner asked for before its questions existed starts once they arrive. When that
/// start fails, the wait says so with Try again, which starts the same test, and nothing starts it
/// again behind the learner's back. Main's `onboarding-steps` and `focus-test` E2E tests.
@MainActor
final class DeferredTestStartTests: XCTestCase {
  private let goalID = "00000000-0000-4000-8000-0000000000a1"

  func testACourseTestThatCantStartOnceItsQuestionsArriveOffersTryAgain() async throws {
    let server = DeferredStartServer(goalID: goalID, test: .course)

    try await expectTryAgainStarts("course-test-start-failed", server: server) { dependencies in
      PlacementTestFlow(goalID: goalID, subject: "Fractions", opening: .start) {}
        .appDependencies(dependencies)
    }
  }

  func testAFocusTestThatCantStartOnceItsQuestionsArriveOffersTryAgain() async throws {
    let server = DeferredStartServer(goalID: goalID, test: .focus)

    try await expectTryAgainStarts("focus-test-start-failed", server: server) { dependencies in
      FocusTestFlow(goalID: goalID, subject: "Biology", host: .plan, startsTest: true) {}
        .appDependencies(dependencies)
    }
  }

  private func expectTryAgainStarts(
    _ name: String, server: DeferredStartServer, flow: (AppDependencies) -> some View
  ) async throws {
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live())

    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack { flow(dependencies) }
        .environment(AppRouter())
        .zoonkStyles())

    try await waitForTestCondition(
      "A start that failed once the questions came didn't offer Try again: \(spoken(in: window))"
    ) {
      spoken(in: window).contains("Something went wrong on our side")
    }
    let startsBeforeTryAgain = await server.starts
    XCTAssertEqual(startsBeforeTryAgain, 2, "The failed start isn't tried again on its own")
    let attachment = XCTAttachment(
      image: UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
      })
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)

    try await activate("Try again", in: window)
    try await waitForTestCondition("Try again didn't start the test: \(spoken(in: window))") {
      spoken(in: window).contains { $0.contains("Which fraction is smaller?") }
    }
    let starts = await server.starts
    XCTAssertEqual(starts, 3)
  }
}

/// The first start finds no questions yet, a read then finds them written, the start made then
/// fails, and the next one opens the test.
private actor DeferredStartServer: ClientTransport {
  enum Test {
    case course
    case focus
  }

  let goalID: String
  let test: Test
  private(set) var starts = 0

  init(goalID: String, test: Test) {
    self.goalID = goalID
    self.test = test
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let payload: String

    switch operationID {
    case "getGoalPlacement":
      payload = placement(status: starts == 0 ? "preparing" : "asking", opened: false)
    case "createPlacementSitting":
      starts += 1

      switch starts {
      case 1: payload = placement(status: "preparing", opened: false)
      case 2: return (HTTPResponse(status: .internalServerError), nil)
      default: payload = placement(status: "asking", opened: true)
      }
    default:
      return (HTTPResponse(status: .notFound), nil)
    }

    var response = HTTPResponse(status: .ok)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(payload))
  }

  private func placement(status: String, opened: Bool) -> String {
    let next =
      #"{"context":null,"image":null,"itemId":"\#(goalID)","skillId":"\#(goalID)","visual":null,"format":"multipleChoice","options":["1/2","1/3"],"question":"Which fraction is smaller?","select":1}"#
    let attempt =
      #"{"answered":0,"chapter":null,"estimatedMinutes":4,"id":"\#(goalID)","length":"quick","part":1,"partComplete":false,"questions":8}"#
    let focusTest =
      opened
      ? #"{"checkpoint":null,"offer":null,"sessionQuestions":"off","sitting":{"questions":6,"answered":0,"minutes":6,"subject":null,"hint":null},"subjects":[],"suggestsFocus":true}"#
      : #"{"checkpoint":null,"offer":{"minutes":6,"questions":6},"sessionQuestions":"off","sitting":null,"subjects":[],"suggestsFocus":true}"#

    return #"""
      {"answered":0,"areas":[],"complete":false,"dayBudgetSpent":0,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],"phases":[],"started":\#(opened),"trueFalseLabels":"trueFalse","result":null,
       "status":"\#(status)","next":\#(opened ? next : "null"),
       "attempt":\#(opened && test == .course ? attempt : "null"),
       "focusTest":\#(test == .focus ? focusTest : "null")}
      """#
  }
}
