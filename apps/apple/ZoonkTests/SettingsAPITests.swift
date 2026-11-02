import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class SettingsAPITests: XCTestCase {
  func testNoLimitSendsAnExplicitNull() async throws {
    let transport = ProfileUpdateTransport()
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport))

    let preferences = try await api.updatePreferences(token: "token", .dailyLimitMinutes(nil))

    XCTAssertEqual(transport.sentBodies.value, [["dailyLimitMinutes": NSNull()]])
    XCTAssertNil(preferences.dailyLimitMinutes)
  }

  func testOtherChangesSendOnlyTheirOwnField() async throws {
    let transport = ProfileUpdateTransport()
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport))

    _ = try await api.updatePreferences(token: "token", .dailyLimitMinutes(30))
    _ = try await api.updatePreferences(token: "token", .soundsEnabled(false))
    _ = try await api.updatePreferences(token: "token", .shareUsageData(false))

    XCTAssertEqual(
      transport.sentBodies.value,
      [["dailyLimitMinutes": 30], ["soundsEnabled": false], ["shareUsageData": false]])
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
            "dailyLimitMinutes": null,
            "dailyTimes": [5, 360, 390],
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
