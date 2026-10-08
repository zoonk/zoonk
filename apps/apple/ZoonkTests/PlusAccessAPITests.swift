import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class PlusAccessAPITests: XCTestCase {
  func testLearnerUnder18NeedsGuardianApprovalWhateverTheirProfileHolds() async throws {
    let api = makePlusAccessAPI(
      transport: PlusAccessResponseTransport(
        expectedMethod: .get,
        expectedOperationID: "getCurrentUserLearningProfile",
        expectedPath: "/me/learning-profile",
        responseBody: learningProfileBody(plusPurchase: "needsGuardianApproval"),
        status: .ok))

    let access = try await api.getPlusPurchaseAccess(token: "learner-session")

    XCTAssertEqual(access, .needsGuardianApproval)
  }

  func testAdultsCanBuyPlusAndGuestsMustSignInFirst() async throws {
    let adultAPI = makePlusAccessAPI(
      transport: PlusAccessResponseTransport(
        expectedMethod: .get,
        expectedOperationID: "getCurrentUserLearningProfile",
        expectedPath: "/me/learning-profile",
        responseBody: learningProfileBody(plusPurchase: "allowed"),
        status: .ok))
    let guestAPI = makePlusAccessAPI(
      transport: PlusAccessResponseTransport(
        expectedMethod: .get,
        expectedOperationID: "getCurrentUserLearningProfile",
        expectedPath: "/me/learning-profile",
        responseBody: learningProfileBody(plusPurchase: "guestNotAllowed"),
        status: .ok))

    let adultAccess = try await adultAPI.getPlusPurchaseAccess(token: "learner-session")
    let guestAccess = try await guestAPI.getPlusPurchaseAccess(token: "learner-session")

    XCTAssertEqual(adultAccess, .allowed)
    XCTAssertEqual(guestAccess, .signInRequired)
  }

  func testExpiredSessionMapsToUnauthorized() async {
    let api = makePlusAccessAPI(
      transport: PlusAccessResponseTransport(
        expectedMethod: .get,
        expectedOperationID: "getCurrentUserLearningProfile",
        expectedPath: "/me/learning-profile",
        responseBody: plusAccessErrorBody(code: "UNAUTHORIZED"),
        status: .unauthorized))

    await assertFailure(.unauthorized) {
      _ = try await api.getPlusPurchaseAccess(token: "learner-session")
    }
  }

  func testApprovalRequestMapsEveryAnswer() async throws {
    let answers: [(HTTPResponse.Status, String, PlusApprovalRequestResult)] = [
      (.accepted, "", .requested),
      (.conflict, plusAccessErrorBody(code: "PLUS_APPROVAL_NOT_NEEDED"), .notNeeded),
      (.unprocessableContent, plusAccessErrorBody(code: "NO_GUARDIAN"), .noGuardian),
    ]

    for (status, body, expectedResult) in answers {
      let api = makePlusAccessAPI(
        transport: PlusAccessResponseTransport(
          expectedMethod: .post,
          expectedOperationID: "requestPlusApproval",
          expectedPath: "/me/plus-approval-requests",
          responseBody: body,
          status: status))

      let result = try await api.requestPlusApproval(token: "learner-session")

      XCTAssertEqual(result, expectedResult, "Unexpected result for \(status)")
    }
  }

  func testOfflineApprovalRequestMapsToNetwork() async {
    let api = makePlusAccessAPI(transport: PlusAccessOfflineTransport())

    await assertFailure(.network) {
      _ = try await api.requestPlusApproval(token: "learner-session")
    }
  }

  private func assertFailure(
    _ expectedFailure: PlusAccessFailure,
    operation: () async throws -> Void
  ) async {
    do {
      try await operation()
      XCTFail("Expected \(expectedFailure)")
    } catch let failure as PlusAccessFailure {
      XCTAssertEqual(failure, expectedFailure)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

/// The profile holds buddy values the app doesn't know, which must not block the Plus check.
private func learningProfileBody(plusPurchase: String) -> String {
  """
  {
    "profile": {
      "activeGoalId": null,
      "ageGroup": "teen",
      "availableGlasses": ["round", "glasses-from-a-future-release"],
      "birth": { "month": 3, "year": 2011 },
      "dailyLimitMinutes": null,
      "buddy": { "glasses": "round", "kind": "buddy-from-a-future-release", "name": null },
      "soundsEnabled": true
    },
    "protections": {
      "ageGroup": "teen",
      "marketingEmailAllowed": false,
      "memoryCategories": ["goals"],
      "memoryOnByDefault": false,
      "plusPurchase": "\(plusPurchase)",
      "sessionReplayAllowed": false
    }
  }
  """
}

private func plusAccessErrorBody(code: String) -> String {
  #"{"error":{"code":"\#(code)","message":"Request failed"}}"#
}

private func makePlusAccessAPI(transport: any ClientTransport) -> PlusAccessAPI {
  PlusAccessAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

private struct PlusAccessResponseTransport: ClientTransport {
  let expectedMethod: HTTPRequest.Method
  let expectedOperationID: String
  let expectedPath: String
  let responseBody: String
  let status: HTTPResponse.Status

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, expectedOperationID)
    XCTAssertEqual(request.method, expectedMethod)
    XCTAssertEqual(request.path, expectedPath)
    XCTAssertEqual(request.headerFields[.authorization], "Bearer learner-session")

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      responseBody.isEmpty ? nil : HTTPBody(responseBody)
    )
  }
}

private struct PlusAccessOfflineTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    throw URLError(.notConnectedToInternet)
  }
}
