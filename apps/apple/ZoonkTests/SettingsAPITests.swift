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
}

/// Records each PATCH body as sent and answers with a saved profile.
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
        #"""
        {
          "profile": {
            "activeGoalId": null,
            "availableGlasses": ["round"],
            "buddy": { "glasses": "round", "kind": "zu", "name": null, "picked": false },
            "dailyLimitMinutes": null,
            "soundsEnabled": true
          }
        }
        """#)
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
