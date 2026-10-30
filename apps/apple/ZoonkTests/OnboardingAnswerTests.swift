import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class OnboardingAnswerTests: XCTestCase {
  func testADayShorterThanTheGoalsTypedTogetherNeedSaysTheLeastItTakes() async throws {
    let refusal = #"""
      {"error":{"code":"DAY_TOO_SHORT","message":"The goals typed together need at least 15 minutes a day","details":{"goals":3,"minutes":15}}}
      """#

    do {
      _ = try await answer(replying: refusal)
      XCTFail("a day too short is refused")
    } catch let error as OnboardingError {
      XCTAssertEqual(error, .dayTooShort(minutes: 15, goals: 3))
    }
  }

  func testAnotherRefusedAnswerIsAFailureToSave() async throws {
    let refusal = #"{"error":{"code":"VALIDATION_ERROR","message":"Can't apply"}}"#

    do {
      _ = try await answer(replying: refusal)
      XCTFail("the answer is refused")
    } catch let error as APIError {
      XCTAssertEqual(error, .unavailable)
    }
  }

  private func answer(replying body: String) async throws -> GoalOnboarding {
    let api = OnboardingAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: RefusingTransport(body: body)))
    let answer = try JSONDecoder().decode(
      OnboardingAnswer.self,
      from: Data(
        #"{"dailyMinutes":5,"question":"schedule","timeZone":"America/Sao_Paulo"}"#.utf8))

    return try await api.answer(
      answer, goalID: "56adb511-8f30-426f-b358-fb4a556aaeb1", token: "token")
  }
}

private struct RefusingTransport: ClientTransport {
  let body: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var response = HTTPResponse(status: .unprocessableContent)
    response.headerFields[.contentType] = "application/json"
    return (response, HTTPBody(self.body))
  }
}
