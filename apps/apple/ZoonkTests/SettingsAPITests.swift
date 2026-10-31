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

    XCTAssertEqual(
      transport.sentBodies.value, [["dailyLimitMinutes": 30], ["soundsEnabled": false]])
  }

  func testTheLimitOffersCoresTimesWithASavedOneTheyLack() async throws {
    let transport = ProfileUpdateTransport(limit: 370)
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport))

    let preferences = try await api.updatePreferences(token: "token", .dailyLimitMinutes(370))

    XCTAssertEqual(preferences.dailyLimitMinutes, 370)
    XCTAssertEqual(preferences.dailyLimitChoices, [5, 360, 370, 390])
  }
}

private struct ProfileUpdateTransport: ClientTransport {
  var limit: Int?
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
            "dailyLimitMinutes": \(limit.map(String.init) ?? "null"),
            "dailyTimes": [5, 360, 390],
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
