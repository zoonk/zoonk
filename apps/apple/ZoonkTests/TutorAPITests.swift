import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

/// A question the allowance refuses is refused when it's asked, the way an answer is: the
/// conversation shows the same limit for either.
final class TutorAPITests: XCTestCase {
  func testAskingAndAnsweringReadARefusalAlike() async {
    let refusals: [(status: Int, json: String, failure: TutorFailure)] = [
      (
        402,
        #"{"error":{"code":"USAGE_LIMIT_REACHED","message":"Limit","details":{"limit":{"period":"day","tier":"free"}}}}"#,
        .limit(.limitReached(period: .day, tier: .free))
      ),
      (403, #"{"error":{"code":"SIGN_UP_REQUIRED","message":"Sign up"}}"#, .signUpRequired),
      (
        429,
        #"{"error":{"code":"USAGE_LIMIT_REACHED","message":"Limit","details":{"limit":{"period":"day","tier":"plus"}}}}"#,
        .limit(.limitReached(period: .day, tier: .plus))
      ),
    ]

    for refusal in refusals {
      let api = refusingAPI(status: refusal.status, json: refusal.json)

      let asking = await askFailure(api)
      let answering = await answerFailure(api)

      XCTAssertEqual(asking, refusal.failure, "asking, \(refusal.status)")
      XCTAssertEqual(answering, refusal.failure, "answering, \(refusal.status)")
    }
  }

  func testASlowDownLiftsOnceItsBreakIsOver() async throws {
    let api = refusingAPI(
      status: 429,
      json: #"{"error":{"code":"SLOW_DOWN","message":"Wait","details":{"retryAfterSeconds":30}}}"#)
    let asked = Date.now

    let failure = await askFailure(api)

    guard case .slowDown(let until) = failure else {
      return XCTFail("Expected a short break, got \(String(describing: failure))")
    }

    XCTAssertEqual(until.timeIntervalSince(asked), 30, accuracy: 5)
    XCTAssertFalse(try XCTUnwrap(failure).isLifted(at: until.addingTimeInterval(-1)))
    XCTAssertTrue(try XCTUnwrap(failure).isLifted(at: until))
  }

  /// The question may have been saved before the error, so the conversation asks it again with the
  /// same request id rather than as a new question.
  func testAServerErrorWhileAskingLeavesTheQuestionToAskAgain() async {
    let api = refusingAPI(status: 500, json: #"{"error":{"code":"INTERNAL","message":"Oops"}}"#)

    do {
      _ = try await api.ask(
        .plan(goalId: "goal", conversationId: "conversation"), question: "Why?", suggestion: nil,
        requestId: "request", token: "token")
      XCTFail("Expected the ask to fail")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }
  }

  private func refusingAPI(status: Int, json: String) -> TutorAPI {
    TutorAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: RefusingTransport(status: .init(code: status), json: json)))
  }

  private func askFailure(_ api: TutorAPI) async -> TutorFailure? {
    do {
      _ = try await api.ask(
        .plan(goalId: "goal", conversationId: "conversation"), question: "Why?", suggestion: nil,
        requestId: "request", token: "token")
      return nil
    } catch {
      return error as? TutorFailure
    }
  }

  private func answerFailure(_ api: TutorAPI) async -> TutorFailure? {
    do {
      for try await _ in api.answer(questionId: "question", token: "token") {}
      return nil
    } catch {
      return error as? TutorFailure
    }
  }
}

private struct RefusingTransport: ClientTransport {
  let status: HTTPResponse.Status
  let json: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(json)
    )
  }
}
