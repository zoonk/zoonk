import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class SettingsAPITests: XCTestCase {

  func testOtherChangesSendOnlyTheirOwnField() async throws {
    let transport = ProfileUpdateTransport()
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport))

    _ = try await api.updatePreferences(token: "token", .soundsEnabled(false))
    _ = try await api.updatePreferences(token: "token", .shareUsageData(false))

    XCTAssertEqual(
      transport.sentBodies.value,
      [["soundsEnabled": false], ["shareUsageData": false]])
  }

  func testNoWebPlusIsNotFound() async {
    let api = webPlusAPI(
      .notFound, #"{"error":{"code":"NOT_FOUND","message":"No web subscription left to cancel"}}"#)

    do {
      _ = try await api.getWebPlus(token: "token")
      XCTFail("Expected no website Plus")
    } catch {
      XCTAssertEqual(error as? APIError, .notFound)
    }
  }

  func testAWebPlusThatAlreadyChangedIsReadAgainNotFailed() async throws {
    try await webPlusAPI(.ok, #"{"endsAt":"2026-12-01T12:00:00.000Z"}"#)
      .cancelWebPlus(token: "token")
    try await webPlusAPI(
      .conflict,
      #"{"error":{"code":"CONFLICT","message":"No renewing web subscription to cancel"}}"#
    ).cancelWebPlus(token: "token")
    try await webPlusAPI(
      .notFound, #"{"error":{"code":"NOT_FOUND","message":"No web subscription left to manage"}}"#
    ).cancelWebPlus(token: "token")
    try await webPlusAPI(.noContent, nil).keepWebPlus(token: "token")
    try await webPlusAPI(
      .conflict,
      #"{"error":{"code":"CONFLICT","message":"Plus isn't set to end with its paid period"}}"#
    ).keepWebPlus(token: "token")
  }

  func testAWebPlusChangeTheServerCouldntMakeFails() async {
    let api = webPlusAPI(
      .internalServerError,
      #"{"error":{"code":"INTERNAL_ERROR","message":"Internal server error"}}"#)

    do {
      try await api.cancelWebPlus(token: "token")
      XCTFail("Expected the cancellation to fail")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }
  }

  func testAMemoryChangeThatChangedSinceIsAnAnswerNotAFailure() async throws {
    let changedSince = APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: MemoryReversalTransport(
        status: .conflict,
        json:
          #"{"error":{"code":"MEMORY_CHANGE_ALREADY_UNDONE","message":"One of these changes was already undone or has changed since"}}"#
      ))
    let unavailable = APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: MemoryReversalTransport(
        status: .internalServerError,
        json: #"{"error":{"code":"INTERNAL_ERROR","message":"Something went wrong"}}"#))
    let change = TutorMemoryChange(
      action: .added, fact: .init(id: "fact", statement: "Likes maps"), previous: nil)

    let restored = try await SettingsAPI(clients: changedSince)
      .restoreMemoryFact(token: "token", factId: "fact")
    let undone = try await TutorAPI(clients: changedSince)
      .undoMemoryChanges([change], token: "token")

    XCTAssertNil(restored)
    XCTAssertFalse(undone)

    do {
      _ = try await SettingsAPI(clients: unavailable).restoreMemoryFact(token: "token", factId: "f")
      XCTFail("Expected a server error to fail")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }

    do {
      _ = try await TutorAPI(clients: unavailable).undoMemoryChanges([change], token: "token")
      XCTFail("Expected a server error to fail")
    } catch {
      XCTAssertEqual(error as? APIError, .unavailable)
    }
  }

  private func webPlusAPI(_ status: HTTPResponse.Status, _ json: String?) -> SettingsAPI {
    SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: WebPlusTransport(status: status, json: json)))
  }
}

private struct WebPlusTransport: ClientTransport {
  let status: HTTPResponse.Status
  let json: String?

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertTrue(
      ["getStripeSubscriptionCancellation", "cancelStripeSubscription", "resumeStripeSubscription"]
        .contains(operationID))
    XCTAssertEqual(request.headerFields[.authorization], "Bearer token")
    XCTAssertNil(body)

    return (
      HTTPResponse(
        status: status, headerFields: json == nil ? [:] : [.contentType: "application/json"]),
      json.map { HTTPBody($0) }
    )
  }
}

private struct MemoryReversalTransport: ClientTransport {
  let status: HTTPResponse.Status
  let json: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(operationID, "createMemoryChangeReversal")

    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(json)
    )
  }
}

private struct ProfileUpdateTransport: ClientTransport {
  let sentBodies = SentBodies()

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(operationID, "updateCurrentUserLearningProfile")

    if let body {
      let data = try await Data(collecting: body, upTo: 10_000)
      sentBodies.append(
        try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? NSDictionary))
    }

    return (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(
        """
        {
          "profile": {
            "activeGoalId": null,
            "availableGlasses": ["round"],
            "buddy": { "glasses": "round", "kind": "zu", "name": null, "picked": false },
            "shareUsageData": null,
            "soundsEnabled": true
          }
        }
        """)
    )
  }
}

private final class SentBodies: @unchecked Sendable {
  private let lock = NSLock()
  private var bodies: [NSDictionary] = []

  var value: [NSDictionary] {
    lock.withLock { bodies }
  }

  func append(_ body: NSDictionary) {
    lock.withLock { bodies.append(body) }
  }
}
