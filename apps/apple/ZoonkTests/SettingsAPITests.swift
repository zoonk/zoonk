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

  func testUsageDataIsSharedUntilTheLearnerChooses() async throws {
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: ProfileUpdateTransport()))

    let preferences = try await api.updatePreferences(token: "token", .soundsEnabled(true))

    XCTAssertTrue(preferences.shareUsageData)
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

  func testAStoppedRenewalStillReadsItsRefund() async throws {
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: WebPlusChoicesTransport(
          status: .ok,
          json: """
            {
              "accountDeletion": { "refund": { "amount": 29.9, "currency": "BRL" } },
              "canResumeRenewal": true,
              "cancellation": null,
              "extraordinary": { "refund": { "amount": 19.5, "currency": "BRL" } },
              "withdrawal": {
                "refund": { "amount": 29.9, "currency": "BRL" },
                "until": "2026-11-14T12:00:00.000Z"
              }
            }
            """)))

    let choices = try await api.getWebPlusCancellation(token: "token")

    XCTAssertEqual(
      choices,
      WebPlusCancellation(
        withdrawal: .init(
          refund: Money(amount: 29.9, currency: "BRL"),
          until: try Date("2026-11-14T12:00:00Z", strategy: .iso8601)),
        periodEnd: nil,
        canResumeRenewal: true,
        accountDeletionRefund: Money(amount: 29.9, currency: "BRL")))
  }

  func testNothingLeftToCancelIsNotFound() async {
    let api = SettingsAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: WebPlusChoicesTransport(
          status: .notFound,
          json: #"{"error":{"code":"NOT_FOUND","message":"Nothing to cancel"}}"#)))

    do {
      _ = try await api.getWebPlusCancellation(token: "token")
      XCTFail("Expected nothing to cancel")
    } catch {
      XCTAssertEqual(error as? APIError, .notFound)
    }
  }
}

private struct WebPlusChoicesTransport: ClientTransport {
  let status: HTTPResponse.Status
  let json: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(operationID, "getStripeSubscriptionCancellation")
    XCTAssertEqual(request.headerFields[.authorization], "Bearer token")

    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(json)
    )
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
